package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.nav.dto.SettingUpdateRequest;
import com.vc.nav.dto.WallpaperLockRequest;
import com.vc.nav.entity.NavSetting;
import com.vc.nav.service.NavSettingService;
import com.vc.nav.service.NavWallpaperService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new com.vc.common.exception.BusinessException(
                    com.vc.common.exception.ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
