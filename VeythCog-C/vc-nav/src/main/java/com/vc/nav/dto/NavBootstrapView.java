package com.vc.nav.dto;

import com.vc.nav.entity.NavCategory;
import com.vc.nav.service.NavWallpaperService;
import com.vc.user.setting.dto.UserSettingView;
import lombok.Data;

import java.util.List;

/**
 * 导航首页一次性启动数据。
 *
 * <p>前端刷新时只需一个请求即可拿到首页配置、分类、当前分类书签和当前壁纸，
 * 避免 setting / categories / bookmarks / wallpaper 四次串行往返。</p>
 * <p>{@code setting} 为用户偏好统一视图（user_setting），字段名与旧 NavSetting 一致。</p>
 */
@Data
public class NavBootstrapView {

    private UserSettingView setting;

    private List<NavCategory> categories;

    /** 服务端确认有效的当前分类；无分类时为 null */
    private Long activeCategoryId;

    private List<BookmarkView> bookmarks;

    /** 当前用户锁定的壁纸；未设置或对象已删除时为 null */
    private NavWallpaperService.WallpaperItem wallpaper;
}
