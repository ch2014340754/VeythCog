package com.vc.nav.service;

import com.vc.nav.dto.BookmarkView;
import com.vc.nav.dto.NavBootstrapView;
import com.vc.nav.entity.NavCategory;
import com.vc.nav.entity.NavSetting;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 导航首页启动数据聚合服务。
 *
 * <p>首页刷新原本要串行请求 setting、categories、bookmarks、wallpaper 四次；
 * 这里合成一次，并把互不依赖的 setting / categories / wallpaper 并行查询，
 * 书签在确定当前分类后再查，减少首屏总等待时间。</p>
 */
@Service
@RequiredArgsConstructor
public class NavBootstrapService {

    /** 聚合查询专用线程池：小规模、守护线程，避免占用 ForkJoin 公共池 */
    private static final ExecutorService BOOTSTRAP_EXECUTOR = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "nav-bootstrap");
        thread.setDaemon(true);
        return thread;
    });

    private final NavSettingService settingService;
    private final NavCategoryService categoryService;
    private final NavBookmarkService bookmarkService;
    private final NavWallpaperService wallpaperService;

    /**
     * 读取当前用户首页启动数据。
     *
     * @param categoryId 前端本地缓存的上次分类；为空或已失效时回落到用户配置 / 默认分类
     */
    public NavBootstrapView get(Long userId, Long categoryId) {
        CompletableFuture<NavSetting> settingFuture =
                CompletableFuture.supplyAsync(() -> settingService.get(userId), BOOTSTRAP_EXECUTOR);
        CompletableFuture<List<NavCategory>> categoriesFuture =
                CompletableFuture.supplyAsync(() -> categoryService.list(userId), BOOTSTRAP_EXECUTOR);
        CompletableFuture<NavWallpaperService.WallpaperItem> wallpaperFuture =
                CompletableFuture.supplyAsync(() -> wallpaperService.current(userId), BOOTSTRAP_EXECUTOR)
                        // 壁纸是装饰数据：S3 抖动不能拖垮整个首页启动
                        .exceptionally(ex -> null);

        NavSetting setting = settingFuture.join();
        List<NavCategory> categories = categoriesFuture.join();
        NavWallpaperService.WallpaperItem wallpaper = wallpaperFuture.join();

        Long requested = categoryId != null ? categoryId : setting.getActiveCategoryId();
        NavCategory active = categories.stream()
                .filter(category -> category.getId().equals(requested))
                .findFirst()
                .orElseGet(() -> categories.stream()
                        .filter(category -> Boolean.TRUE.equals(category.getIsDefault()))
                        .findFirst()
                        .orElse(categories.isEmpty() ? null : categories.get(0)));

        Long activeCategoryId = active == null ? null : active.getId();
        List<BookmarkView> bookmarks = activeCategoryId == null
                ? List.of()
                : bookmarkService.listOwned(userId, activeCategoryId);

        NavBootstrapView view = new NavBootstrapView();
        view.setSetting(setting);
        view.setCategories(categories);
        view.setActiveCategoryId(activeCategoryId);
        view.setBookmarks(bookmarks);
        view.setWallpaper(wallpaper);
        return view;
    }
}
