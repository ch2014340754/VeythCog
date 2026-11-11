package com.vc.nav.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3Bucket;
import com.vc.common.s3.S3ClientProvider;
import com.vc.common.s3.S3PresignService;
import com.vc.nav.dto.WallpaperLockRequest;
import com.vc.nav.entity.NavSetting;
import com.vc.nav.mapper.NavSettingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 壁纸服务：从 S3 wallpapers 桶随机取一张 / 列出清单 / 锁定。
 * <p>wallpapers 桶为私有桶，所有访问都走预签名 URL。</p>
 * <p>有效期取 7 天（SigV4 上限）：前端会把 URL 直接塞给 img，若用默认 15 分钟，
 * 页面开久一点再刷新就会 403，壁纸"自己消失"。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NavWallpaperService {

    /** 壁纸预签名 URL 有效期：7 天（S3 SigV4 上限），避免长时间挂着的页面刷新即 403 */
    private static final Duration WALLPAPER_URL_EXPIRY = Duration.ofDays(7);

    /** 缩略图目标宽度：壁纸库卡片实际显示 150~200px，480px 足够清晰又不费流量 */
    private static final int THUMB_WIDTH = 480;

    /** 缩略图内存缓存上限，超过直接整体清空，避免无界增长（壁纸库规模很小） */
    private static final int THUMB_CACHE_LIMIT = 256;

    private final Map<String, Thumb> thumbCache = new ConcurrentHashMap<>();

    private final S3ClientProvider clientProvider;
    private final S3PresignService presignService;
    private final NavSettingMapper settingMapper;

    /**
     * 壁纸项（key + 预签名 URL）。
     */
    public record WallpaperItem(String key, String url) {}

    /**
     * 缩略图（字节 + Content-Type）。由后端缩放后下发，配合长缓存头，
     * 前端壁纸库只需下载一次几十 KB，而不是每张原图几百 KB。
     */
    public record Thumb(byte[] data, String contentType) {}

    /**
     * 生成（或取缓存中的）壁纸缩略图。
     * key 只允许桶内平铺对象（不含路径分隔符），配合 getObject 的存在性校验，
     * 既不能用作任意路径探测，也省掉每次请求都 list 一遍桶的开销。
     */
    public Thumb thumb(String key) {
        if (key == null || key.isBlank() || key.contains("/") || key.contains("..")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "壁纸 key 不合法");
        }
        Thumb cached = thumbCache.get(key);
        if (cached != null) {
            return cached;
        }
        try {
            S3Client client = clientProvider.getS3Client();
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(S3Bucket.WALLPAPERS.getBucketName())
                    .key(key)
                    .build();
            try (ResponseInputStream<GetObjectResponse> in = client.getObject(request)) {
                byte[] raw = in.readAllBytes();
                Thumb thumb = shrink(raw, in.response().contentType(), key);
                if (thumbCache.size() >= THUMB_CACHE_LIMIT) {
                    thumbCache.clear();
                }
                thumbCache.put(key, thumb);
                return thumb;
            }
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "壁纸不存在或已删除");
            }
            log.warn("读取壁纸失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "缩略图生成失败");
        } catch (Exception e) {
            log.warn("生成壁纸缩略图失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "缩略图生成失败");
        }
    }

    /**
     * 等比缩到 {@link #THUMB_WIDTH} 宽并转 JPEG。
     * 无法解码的格式（如 webp 无 ImageIO 插件）或本来就比目标小的图，直接回传原始字节。
     */
    private Thumb shrink(byte[] raw, String contentType, String key) {
        String fallbackType = contentType == null || contentType.isBlank() ? guessContentType(key) : contentType;
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(raw));
            if (src == null || src.getWidth() <= THUMB_WIDTH) {
                return new Thumb(raw, fallbackType);
            }
            int targetHeight = Math.max(1, (int) Math.round(src.getHeight() * (double) THUMB_WIDTH / src.getWidth()));
            BufferedImage dst = new BufferedImage(THUMB_WIDTH, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = dst.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(src, 0, 0, THUMB_WIDTH, targetHeight, null);
            g.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(dst, "jpg", out);
            return new Thumb(out.toByteArray(), "image/jpeg");
        } catch (Exception e) {
            log.warn("缩略图缩放失败，回退原图 key={}：{}", key, e.getMessage());
            return new Thumb(raw, fallbackType);
        }
    }

    private static String guessContentType(String key) {
        String lower = key.toLowerCase();
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        return "image/jpeg";
    }

    /**
     * 列出 wallpapers 桶所有对象（预签名 URL）。
     */
    public List<WallpaperItem> list() {
        List<String> keys = listWallpaperKeys();
        List<WallpaperItem> result = new ArrayList<>(keys.size());
        for (String key : keys) {
            String url = presignService.presignGetUrl(S3Bucket.WALLPAPERS, key, WALLPAPER_URL_EXPIRY);
            result.add(new WallpaperItem(key, url));
        }
        return result;
    }

    /**
     * 随机取一张壁纸（预签名 URL）。
     * 桶为空时返回 null（前端用本地默认壁纸兜底）。
     */
    public WallpaperItem random() {
        List<String> keys = listWallpaperKeys();
        if (keys.isEmpty()) {
            return null;
        }
        String key = keys.get(ThreadLocalRandom.current().nextInt(keys.size()));
        String url = presignService.presignGetUrl(S3Bucket.WALLPAPERS, key, WALLPAPER_URL_EXPIRY);
        return new WallpaperItem(key, url);
    }

    /**
     * 当前用户锁定的壁纸（预签名 URL）。
     * 未设置或对象已从桶中删除时返回 null，前端回落纯色兜底。
     */
    public WallpaperItem current(Long userId) {
        NavSetting setting = settingMapper.selectById(userId);
        String key = setting == null ? null : setting.getCurrentWallpaperKey();
        if (key == null || key.isBlank()) {
            return null;
        }
        if (!listWallpaperKeys().contains(key)) {
            return null;
        }
        String url = presignService.presignGetUrl(S3Bucket.WALLPAPERS, key, WALLPAPER_URL_EXPIRY);
        return new WallpaperItem(key, url);
    }

    /**
     * 锁定壁纸（写 nav_setting.current_wallpaper_key）。
     * key 传 null 表示解锁随机。
     */
    public void lock(Long userId, WallpaperLockRequest req) {
        NavSetting setting = settingMapper.selectById(userId);
        boolean isNew = (setting == null);
        if (isNew) {
            setting = new NavSetting();
            setting.setUserId(userId);
            setting.setSearchEngine("baidu");
        }
        setting.setCurrentWallpaperKey(req.getKey());
        if (isNew) {
            settingMapper.insert(setting);
        } else {
            settingMapper.updateById(setting);
        }
    }

    /**
     * 列出 wallpapers 桶所有对象 key。
     * S3 配置缺失时静默返回空列表（前端用本地默认壁纸兜底）。
     */
    private List<String> listWallpaperKeys() {
        try {
            S3Client client = clientProvider.getS3Client();
            ListObjectsV2Request request = ListObjectsV2Request.builder()
                    .bucket(S3Bucket.WALLPAPERS.getBucketName())
                    .build();
            ListObjectsV2Response response = client.listObjectsV2(request);
            List<String> keys = new ArrayList<>();
            for (S3Object obj : response.contents()) {
                // 跳过目录占位（以 / 结尾的 key）
                if (!obj.key().endsWith("/")) {
                    keys.add(obj.key());
                }
            }
            return keys;
        } catch (Exception e) {
            log.warn("列出 wallpapers 桶失败，前端将用本地默认壁纸兜底：{}", e.getMessage());
            return List.of();
        }
    }
}
