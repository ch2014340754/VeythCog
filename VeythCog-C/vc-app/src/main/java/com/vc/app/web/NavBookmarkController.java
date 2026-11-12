package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.nav.dto.BookmarkCreateRequest;
import com.vc.nav.dto.BookmarkReorderRequest;
import com.vc.nav.dto.BookmarkUpdateRequest;
import com.vc.nav.dto.BookmarkView;
import com.vc.nav.dto.NavIconView;
import com.vc.nav.service.NavBookmarkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 导航书签接口（分类下的常用网站）。
 */
@RestController
@RequestMapping("/nav/bookmarks")
@RequiredArgsConstructor
public class NavBookmarkController {

    private final NavBookmarkService bookmarkService;

    /** 1. 列出某分类下的书签（按 sort_order 升序） */
    @GetMapping
    public BaseResponse<List<BookmarkView>> list(@RequestParam Long categoryId) {
        return ResultUtils.success(bookmarkService.list(currentUserId(), categoryId));
    }

    /** 1.0 列出全部书签：搜索框本地联想一次拉取 */
    @GetMapping("/all")
    public BaseResponse<List<BookmarkView>> listAll() {
        return ResultUtils.success(bookmarkService.listAll(currentUserId()));
    }

    /** 1.1 解析单个书签图标：前端缓存未命中时调用（服务端缓存 → DB → S3 直链） */
    @GetMapping("/{id}/icon")
    public BaseResponse<NavIconView> icon(@PathVariable Long id) {
        return ResultUtils.success(bookmarkService.resolveIcon(currentUserId(), id));
    }

    /** 2. 新建书签 */
    @PostMapping
    public BaseResponse<Long> create(@Valid @RequestBody BookmarkCreateRequest req) {
        return ResultUtils.success(bookmarkService.create(currentUserId(), req));
    }

    /** 3. 更新书签 */
    @PutMapping("/{id}")
    public BaseResponse<Void> update(@PathVariable Long id, @Valid @RequestBody BookmarkUpdateRequest req) {
        bookmarkService.update(currentUserId(), id, req);
        return ResultUtils.success(null);
    }

    /** 4. 删除书签 */
    @DeleteMapping("/{id}")
    public BaseResponse<Void> delete(@PathVariable Long id) {
        bookmarkService.delete(currentUserId(), id);
        return ResultUtils.success(null);
    }

    /** 5. 批量排序 */
    @PutMapping("/reorder")
    public BaseResponse<Void> reorder(@RequestBody BookmarkReorderRequest req) {
        bookmarkService.reorder(currentUserId(), req);
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
