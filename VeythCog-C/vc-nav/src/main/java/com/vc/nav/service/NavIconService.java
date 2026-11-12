package com.vc.nav.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3Bucket;
import com.vc.common.s3.S3FileValidator;
import com.vc.common.s3.S3ObjectKeyUtils;
import com.vc.common.s3.S3PresignService;
import com.vc.common.s3.S3StorageClient;
import com.vc.common.s3.exception.StorageException;
import com.vc.common.s3.exception.StorageValidationException;
import com.vc.nav.dto.IconSyncResult;
import com.vc.nav.dto.IconUploadResult;
import com.vc.nav.dto.NavIconView;
import com.vc.nav.entity.NavBookmark;
import com.vc.nav.mapper.NavBookmarkMapper;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 书签图标服务：负责「站点抓取 / 自定义上传 → S3」以及「图标地址解析」。
 *
 * <p>图标地址解析分两级：</p>
 * <ol>
 *   <li>进程内缓存（{@link #CACHE_TTL} 有效，签名变化即失效）；</li>
 *   <li>未命中再查 DB 的 {@code icon_key}，拼 {@code public-icons} 公开直链。</li>
 * </ol>
 *
 * <p>同步策略：只补 {@code icon_type=auto} 且没有 {@code icon_key} 的书签；
 * 成功 / 失败都写 {@code icon_synced_at}，失败按 1 天冷却，避免每次启动都重试坏站点。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NavIconService {

    /** S3 前缀：所有书签图标都放这里，便于按前缀清理与审计 */
    public static final String ICON_PREFIX = "icons";

    /** 自定义上传大小上限，与站点图标读取上限保持一致 */
    public static final int MAX_ICON_BYTES = 512 * 1024;

    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    /** 同步失败后的冷却时间 */
    private static final Duration SYNC_RETRY_COOLDOWN = Duration.ofDays(1);

    private static final int CACHE_LIMIT = 2000;

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("png", "jpg", "jpeg", "webp", "gif", "ico");

    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/png", "image/jpeg", "image/webp", "image/gif",
                    "image/x-icon", "image/vnd.microsoft.icon");

    private final NavBookmarkMapper bookmarkMapper;
    private final S3StorageClient storageClient;
    private final S3PresignService presignService;
    private final SiteIconFetcher siteIconFetcher;

    private final Map<Long, CacheEntry> iconCache = new ConcurrentHashMap<>();

    /** 同步线程池：固定 2 线程，守护线程，不阻塞应用关闭 */
    private final ExecutorService syncExecutor = Executors.newFixedThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "nav-icon-sync");
        thread.setDaemon(true);
        return thread;
    });

    private record CacheEntry(String signature, NavIconView view, Instant expiresAt) {
    }

    /**
     * 从站点抓取图标并上传 S3（弹窗「获取图标」）。
     */
    public IconUploadResult fetchFromSite(String url) {
        SiteIconFetcher.FetchedIcon fetched = siteIconFetcher.fetch(url);
        String key = S3ObjectKeyUtils.buildKey(ICON_PREFIX, "favicon." + fetched.extension());
        try {
            storageClient.upload(S3Bucket.PUBLIC_ICONS, key, fetched.data(), fetched.mimeType());
            return new IconUploadResult(key, publicUrl(key), fetched.siteTitle(), fetched.sourceUrl());
        } catch (StorageValidationException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, e.getMessage());
        } catch (StorageException e) {
            log.warn("上传站点图标失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "图标上传失败，请稍后重试");
        }
    }

    /**
     * 上传用户自定义图标（multipart 由 Controller 读成字节后传入，vc-nav 不依赖 Web 层）。
     */
    public IconUploadResult uploadCustom(byte[] content, String filename, String contentType) {
        if (content == null || content.length == 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上传文件不能为空");
        }
        if (content.length > MAX_ICON_BYTES) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标不能超过 512KB");
        }
        String safeFilename = filename == null || filename.isBlank() ? "icon.png" : filename;
        byte[] head = Arrays.copyOf(content, Math.min(16, content.length));
        String detectedMime = S3FileValidator.detectMimeType(head);
        if (detectedMime == null) {
            // SVG 等无魔数格式直接拒绝：公开桶里的 SVG 可能被浏览器当脚本执行
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标仅支持 PNG / JPEG / WebP / GIF / ICO 位图");
        }

        // 浏览器 / 部分客户端会把图片报成 application/octet-stream，此时声明类型不可信，
        // 只按文件头魔数 + 后缀校验，避免合法 PNG 被挡掉。
        String declaredType = normalizeContentType(contentType);
        try {
            S3FileValidator.validate(safeFilename, declaredType, head,
                    ALLOWED_EXTENSIONS, ALLOWED_CONTENT_TYPES);
        } catch (StorageValidationException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, e.getMessage());
        }
        String key = S3ObjectKeyUtils.buildKey(ICON_PREFIX, safeFilename);
        String uploadContentType = detectedMime != null ? detectedMime : declaredType;
        try {
            storageClient.upload(S3Bucket.PUBLIC_ICONS, key, content, uploadContentType);
            return new IconUploadResult(key, publicUrl(key), null, null);
        } catch (StorageValidationException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, e.getMessage());
        } catch (StorageException e) {
            log.warn("上传自定义图标失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "图标上传失败，请稍后重试");
        }
    }

    /**
     * 解析书签图标地址：进程内缓存 → DB → S3 公开直链。
     */
    public NavIconView resolve(Long userId, Long bookmarkId) {
        NavBookmark bookmark = requireBookmark(userId, bookmarkId);
        String signature = signature(bookmark);
        CacheEntry cached = iconCache.get(bookmarkId);
        if (cached != null && cached.signature().equals(signature)
                && cached.expiresAt().isAfter(Instant.now())) {
            return cached.view();
        }
        NavIconView view = buildView(bookmark);
        if (iconCache.size() >= CACHE_LIMIT) {
            iconCache.clear();
        }
        iconCache.put(bookmarkId, new CacheEntry(signature, view, Instant.now().plus(CACHE_TTL)));
        return view;
    }

    /** 书签变更后清掉解析缓存 */
    public void evict(Long bookmarkId) {
        if (bookmarkId != null) {
            iconCache.remove(bookmarkId);
        }
    }

    /**
     * 校验前端回传的 iconKey：必须以 icons/ 开头且对象存在。
     * <p>防止把壁纸桶 / 任意对象 key 绑到书签上。</p>
     */
    public void requireIconObject(String iconKey) {
        if (iconKey == null || iconKey.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标 key 不能为空");
        }
        String key = iconKey.trim();
        if (!key.startsWith(ICON_PREFIX + "/")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标 key 不合法");
        }
        try {
            S3ObjectKeyUtils.requireValidKey(key);
            if (!storageClient.exists(S3Bucket.PUBLIC_ICONS, key)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标文件不存在，请重新上传");
            }
        } catch (StorageValidationException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, e.getMessage());
        } catch (StorageException e) {
            log.warn("校验图标对象失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "图标校验失败，请稍后重试");
        }
    }

    /**
     * 同步当前用户缺失的自动图标（手动接口，同步返回结果）。
     */
    public IconSyncResult syncMissing(Long userId, int limit) {
        LambdaQueryWrapper<NavBookmark> wrapper = new LambdaQueryWrapper<NavBookmark>()
                .eq(NavBookmark::getIconType, NavBookmark.ICON_TYPE_AUTO)
                .and(w -> w.isNull(NavBookmark::getIconKey).or().eq(NavBookmark::getIconKey, ""))
                .and(w -> w.isNull(NavBookmark::getIconSyncedAt)
                        .or().lt(NavBookmark::getIconSyncedAt, OffsetDateTime.now().minus(SYNC_RETRY_COOLDOWN)))
                .orderByAsc(NavBookmark::getId)
                .last("LIMIT " + Math.max(1, limit));
        if (userId != null) {
            wrapper.eq(NavBookmark::getUserId, userId);
        }
        List<NavBookmark> bookmarks = bookmarkMapper.selectList(wrapper);
        int success = 0;
        int failed = 0;
        for (NavBookmark bookmark : bookmarks) {
            if (syncOne(bookmark)) {
                success++;
            } else {
                failed++;
            }
        }
        return new IconSyncResult(bookmarks.size(), success, failed);
    }

    /** 启动时后台补同步（不阻塞 Spring 启动） */
    public void syncMissingAsync(int limit) {
        syncExecutor.execute(() -> {
            try {
                IconSyncResult result = syncMissing(null, limit);
                log.info("导航图标启动同步完成：total={}, success={}, failed={}",
                        result.total(), result.success(), result.failed());
            } catch (Exception e) {
                log.warn("导航图标启动同步失败：{}", e.getMessage());
            }
        });
    }

    /** 新建书签后异步补一次图标，避免用户每次都要手动点「获取图标」 */
    public void syncOneAsync(NavBookmark bookmark) {
        if (bookmark == null || bookmark.getId() == null) {
            return;
        }
        syncExecutor.execute(() -> syncOne(bookmark));
    }

    /** 单条同步：抓取 → 上传 → 回写 icon_key / icon_synced_at */
    public boolean syncOne(NavBookmark bookmark) {
        if (bookmark == null || bookmark.getId() == null) {
            return false;
        }
        try {
            IconUploadResult result = fetchFromSite(bookmark.getUrl());
            bookmark.setIconKey(result.iconKey());
            bookmark.setIconSyncedAt(OffsetDateTime.now());
            bookmarkMapper.updateById(bookmark);
            evict(bookmark.getId());
            log.info("书签图标同步成功 id={} title={} key={}", bookmark.getId(), bookmark.getTitle(), result.iconKey());
            return true;
        } catch (Exception e) {
            log.warn("书签图标同步失败 id={} url={}：{}", bookmark.getId(), bookmark.getUrl(), e.getMessage());
            // 失败也记时间，避免每次启动立刻重试同一批失败站点
            try {
                bookmark.setIconSyncedAt(OffsetDateTime.now());
                bookmarkMapper.updateById(bookmark);
                evict(bookmark.getId());
            } catch (Exception ignored) {
                // 回写失败不影响主流程
            }
            return false;
        }
    }

    private NavIconView buildView(NavBookmark bookmark) {
        String type = normalizeType(bookmark.getIconType(), true);
        if (NavBookmark.ICON_TYPE_TEXT.equals(type)) {
            return new NavIconView(NavBookmark.ICON_TYPE_TEXT, null,
                    bookmark.getIconText(), colorOrDefault(bookmark.getIconColor()));
        }
        String key = bookmark.getIconKey();
        if (key == null || key.isBlank()) {
            return new NavIconView(type, null, null, null);
        }
        try {
            return new NavIconView(type, publicUrl(key), null, null);
        } catch (Exception e) {
            log.warn("生成图标直链失败 id={} key={}：{}", bookmark.getId(), key, e.getMessage());
            return new NavIconView(type, null, null, null);
        }
    }

    private String publicUrl(String key) {
        return presignService.publicUrl(S3Bucket.PUBLIC_ICONS, key);
    }

    private static String signature(NavBookmark bookmark) {
        return String.join("|",
                String.valueOf(bookmark.getIconType()),
                String.valueOf(bookmark.getIconKey()),
                String.valueOf(bookmark.getIconText()),
                String.valueOf(bookmark.getIconColor()),
                String.valueOf(bookmark.getIconSyncedAt()),
                String.valueOf(bookmark.getUpdatedAt()));
    }

    private NavBookmark requireBookmark(Long userId, Long bookmarkId) {
        NavBookmark bookmark = bookmarkMapper.selectById(bookmarkId);
        if (bookmark == null || !bookmark.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "书签不存在或无权限");
        }
        return bookmark;
    }

    /** 未知类型按 auto 处理（历史数据 / 前端传空） */
    public static String normalizeType(String type, boolean nullAsAuto) {
        if (type == null || type.isBlank()) {
            return nullAsAuto ? NavBookmark.ICON_TYPE_AUTO : null;
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        if (NavBookmark.ICON_TYPE_AUTO.equals(normalized)
                || NavBookmark.ICON_TYPE_UPLOAD.equals(normalized)
                || NavBookmark.ICON_TYPE_TEXT.equals(normalized)) {
            return normalized;
        }
        return nullAsAuto ? NavBookmark.ICON_TYPE_AUTO : null;
    }

    public static String colorOrDefault(String color) {
        return color == null || color.isBlank() ? NavBookmark.DEFAULT_ICON_COLOR : color;
    }

    /** 去掉 multipart 的 charset 参数；未知类型统一按 null 处理（交由魔数判断） */
    private static String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        String normalized = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || "application/octet-stream".equals(normalized)) {
            return null;
        }
        return normalized;
    }

    @PreDestroy
    public void shutdown() {
        syncExecutor.shutdownNow();
    }
}
