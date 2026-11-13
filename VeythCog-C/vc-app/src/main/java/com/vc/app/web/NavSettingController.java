package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.nav.dto.NavBootstrapView;
import com.vc.nav.dto.SettingUpdateRequest;
import com.vc.nav.dto.WallpaperLockRequest;
import com.vc.nav.entity.NavSetting;
import com.vc.nav.service.NavBootstrapService;
import com.vc.nav.service.NavSettingService;
import com.vc.nav.service.NavWallpaperService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.time.Duration;
import java.util.List;

/**
 * 导航首页配置 + 壁纸接口。
 */
@RestController
@RequestMapping("/nav")
@RequiredArgsConstructor
public class NavSettingController {

    private final NavSettingService settingService;
    private final NavWallpaperService wallpaperService;
    private final NavBootstrapService bootstrapService;

    /**
     * 0. 首页启动数据聚合：配置 + 分类 + 当前分类书签 + 当前壁纸。
     * <p>categoryId 为前端本地缓存的上次分类，失效时服务端自动回落到默认分类。</p>
     */
    @GetMapping("/bootstrap")
    public BaseResponse<NavBootstrapView> bootstrap(
            @RequestParam(value = "categoryId", required = false) Long categoryId) {
        return ResultUtils.success(bootstrapService.get(currentUserId(), categoryId));
    }

    /** 1. 读取当前用户首页配置 */
    @GetMapping("/setting")
    public BaseResponse<NavSetting> getSetting() {
        return ResultUtils.success(settingService.get(currentUserId()));
    }

    /** 2. 更新用户配置（搜索引擎 / 上次选中分类） */
    @PutMapping("/setting")
    public BaseResponse<Void> updateSetting(@RequestBody SettingUpdateRequest req) {
        settingService.update(currentUserId(), req);
        return ResultUtils.success(null);
    }

    /** 3. 随机取一张壁纸（预签名 URL；桶空返回 null） */
    @GetMapping("/wallpaper/random")
    public BaseResponse<NavWallpaperService.WallpaperItem> randomWallpaper() {
        return ResultUtils.success(wallpaperService.random());
    }

    /** 4. 列出壁纸清单（key + 预签名 URL） */
    @GetMapping("/wallpaper/list")
    public BaseResponse<List<NavWallpaperService.WallpaperItem>> listWallpapers() {
        return ResultUtils.success(wallpaperService.list());
    }

    /** 5. 锁定壁纸（key 传 null 解锁随机） */
    @PutMapping("/wallpaper/lock")
    public BaseResponse<Void> lockWallpaper(@RequestBody WallpaperLockRequest req) {
        wallpaperService.lock(currentUserId(), req);
        return ResultUtils.success(null);
    }

    /** 6. 当前用户锁定的壁纸（未设置返回 null，前端回落纯色兜底） */
    @GetMapping("/wallpaper/current")
    public BaseResponse<NavWallpaperService.WallpaperItem> currentWallpaper() {
        return ResultUtils.success(wallpaperService.current(currentUserId()));
    }

    /**
     * 7. 壁纸缩略图（服务端缩放到 480px 宽 + 长缓存头）。
     * <p>前端用 {@code <img src>} 直连，无法携带 Authorization，因此该接口在 SecurityConfig 中放行；
     * key 必须命中桶内对象才返回，不能用作任意路径探测。
     * <p>返回头带 {@code Cache-Control: public, max-age=7d, immutable}，
     * 同一张壁纸只在首次打开壁纸库时下载一次（约几十 KB）。
     */
    @GetMapping("/wallpaper/thumb")
    public ResponseEntity<byte[]> wallpaperThumb(@RequestParam("key") String key) {
        NavWallpaperService.Thumb thumb = wallpaperService.thumb(key);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(thumb.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic().immutable())
                .body(thumb.data());
    }

    /**
     * 8. 动态壁纸视频流（服务端代理 + Range）。
     * <p>浏览器 {@code <video>} 首帧发 Range 请求，而对象存储对带 Range 的预签名 GET 会重置连接，
     * 因此视频改由后端流式转发；key 仍必须命中桶内对象，接口与缩略图一样放行。</p>
     */
    @GetMapping("/wallpaper/video")
    public ResponseEntity<StreamingResponseBody> wallpaperVideo(
            @RequestParam("key") String key,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
        NavWallpaperService.VideoStream video = wallpaperService.video(key, range);
        StreamingResponseBody body = outputStream -> {
            try (var stream = video.stream()) {
                stream.transferTo(outputStream);
            }
        };
        ResponseEntity.BodyBuilder builder = ResponseEntity
                .status(video.partial() ? 206 : 200)
                .contentType(MediaType.parseMediaType(video.contentType()))
                .contentLength(video.length())
                .header("Accept-Ranges", "bytes")
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic().immutable());
        if (video.partial()) {
            builder.header("Content-Range",
                    "bytes " + video.start() + "-" + video.end() + "/" + video.totalLength());
        }
        return builder.body(body);
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new com.vc.common.exception.BusinessException(
                    com.vc.common.exception.ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
