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
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
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
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

    /** 静态图后缀白名单（只认这些才当壁纸下发） */
    private static final Set<String> IMAGE_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "webp", "gif", "bmp", "avif");

    /** 动态壁纸后缀白名单（浏览器 <video> 能直接播的容器格式） */
    private static final Set<String> VIDEO_EXTENSIONS =
            Set.of("mp4", "webm", "mov", "m4v", "ogv");

    /** 壁纸类型：由服务端判定并随清单下发，前端不再靠文件名猜 */
    public static final String KIND_IMAGE = "image";
    public static final String KIND_VIDEO = "video";

    /**
     * 壁纸项（key + 预签名 URL + 类型）。
     * <p>kind 是权威判定：前端据此决定用 {@code <img>} 还是 {@code <video>} 渲染，
     * 避免把 mp4 塞进 img 变成裂图。</p>
     */
    public record WallpaperItem(String key, String url, String kind) {}

    /** 按 key 后缀判定壁纸类型；非白名单后缀返回 null（不是壁纸） */
    public static String kindOf(String key) {
        String ext = extensionOf(key);
        if (ext == null) {
            return null;
        }
        if (VIDEO_EXTENSIONS.contains(ext)) {
            return KIND_VIDEO;
        }
        if (IMAGE_EXTENSIONS.contains(ext)) {
            return KIND_IMAGE;
        }
        return null;
    }

    private static String extensionOf(String key) {
        if (key == null) {
            return null;
        }
        int dot = key.lastIndexOf('.');
        if (dot < 0 || dot == key.length() - 1) {
            return null;
        }
        return key.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /**
     * 缩略图（字节 + Content-Type）。由后端缩放后下发，配合长缓存头，
     * 前端壁纸库只需下载一次几十 KB，而不是每张原图几百 KB。
     */
    public record Thumb(byte[] data, String contentType) {}

    /**
     * 动态壁纸视频流（服务端代理，避免浏览器直连预签名地址时 Range 请求被对象存储重置）。
     *
     * @param stream       S3 响应流，调用方负责关闭
     * @param contentType  Content-Type
     * @param totalLength  对象总字节数
     * @param start        本次返回的起始字节（含）
     * @param end          本次返回的结束字节（含）
     */
    public record VideoStream(ResponseInputStream<GetObjectResponse> stream, String contentType,
                              long totalLength, long start, long end) {
        public long length() {
            return end - start + 1;
        }

        public boolean partial() {
            return start > 0 || end < totalLength - 1;
        }
    }

    /**
     * 生成（或取缓存中的）壁纸缩略图。
     * key 只允许桶内平铺对象（不含路径分隔符），配合 getObject 的存在性校验，
     * 既不能用作任意路径探测，也省掉每次请求都 list 一遍桶的开销。
     */
    public Thumb thumb(String key) {
        if (key == null || key.isBlank() || key.contains("/") || key.contains("..")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "壁纸 key 不合法");
        }
        // 动态壁纸必须由前端用 <video> 直接播预签名 URL；缩略图接口只服务静态图
        if (KIND_VIDEO.equals(kindOf(key))) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "动态壁纸不支持缩略图，请直接使用视频地址");
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
     * 动态壁纸视频流：由后端代理 S3，按浏览器 Range 请求返回 206。
     * <p>预签名地址虽然能整段 GET，但对象存储在带 Range 的预签名请求上会直接重置连接，
     * 浏览器 {@code <video>} 首帧恰好依赖 Range，因此不能把预签名地址直接交给视频元素。</p>
     */
    public VideoStream video(String key, String rangeHeader) {
        if (key == null || key.isBlank() || key.contains("/") || key.contains("..")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "壁纸 key 不合法");
        }
        if (!KIND_VIDEO.equals(kindOf(key))) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "该壁纸不是动态壁纸");
        }
        try {
            S3Client client = clientProvider.getS3Client();
            HeadObjectResponse meta = client.headObject(HeadObjectRequest.builder()
                    .bucket(S3Bucket.WALLPAPERS.getBucketName())
                    .key(key)
                    .build());
            long total = meta.contentLength();
            if (total <= 0) {
                throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "壁纸不存在或已删除");
            }
            String contentType = meta.contentType();
            if (contentType == null || contentType.isBlank()) {
                contentType = key.toLowerCase(Locale.ROOT).endsWith(".webm") ? "video/webm" : "video/mp4";
            }
            long[] range = parseRange(rangeHeader, total);
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(S3Bucket.WALLPAPERS.getBucketName())
                    .key(key)
                    .range("bytes=" + range[0] + "-" + range[1])
                    .build();
            ResponseInputStream<GetObjectResponse> stream = client.getObject(request);
            return new VideoStream(stream, contentType, total, range[0], range[1]);
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "壁纸不存在或已删除");
            }
            log.warn("读取动态壁纸失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "动态壁纸读取失败");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("代理动态壁纸失败 key={}：{}", key, e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "动态壁纸读取失败");
        }
    }

    /**
     * 解析单段 Range（bytes=start-end / bytes=start- / bytes=-suffix）。
     * 非法或越界时退回整段，避免浏览器拿到无法理解的 416。
     */
    private static long[] parseRange(String header, long total) {
        long[] full = new long[]{0, total - 1};
        if (header == null || header.isBlank() || !header.startsWith("bytes=")) {
            return full;
        }
        String spec = header.substring(6).split(",")[0].trim();
        int dash = spec.indexOf('-');
        if (dash < 0) {
            return full;
        }
        try {
            String startText = spec.substring(0, dash).trim();
            String endText = spec.substring(dash + 1).trim();
            long start;
            long end;
            if (startText.isEmpty()) {
                long suffix = Long.parseLong(endText);
                if (suffix <= 0) {
                    return full;
                }
                start = Math.max(0, total - suffix);
                end = total - 1;
            } else {
                start = Long.parseLong(startText);
                end = endText.isEmpty() ? total - 1 : Math.min(Long.parseLong(endText), total - 1);
            }
            if (start < 0 || start >= total || start > end) {
                return full;
            }
            return new long[]{start, end};
        } catch (NumberFormatException e) {
            return full;
        }
    }


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
            result.add(new WallpaperItem(key, url, kindOf(key)));
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
        return new WallpaperItem(key, url, kindOf(key));
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
        return new WallpaperItem(key, url, kindOf(key));
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
                String key = obj.key();
                // 跳过目录占位（以 / 结尾的 key）
                if (key.endsWith("/")) {
                    continue;
                }
                // 只下发白名单后缀的壁纸文件，桶里混进的其它文件（zip/txt/无后缀）直接忽略
                if (kindOf(key) == null) {
                    log.warn("跳过非壁纸文件 key={}", key);
                    continue;
                }
                keys.add(key);
            }
            return keys;
        } catch (Exception e) {
            log.warn("列出 wallpapers 桶失败，前端将用本地默认壁纸兜底：{}", e.getMessage());
            return List.of();
        }
    }
}
