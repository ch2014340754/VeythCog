package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.nav.dto.CategoryCreateRequest;
import com.vc.nav.dto.CategoryReorderRequest;
import com.vc.nav.dto.CategoryUpdateRequest;
import com.vc.nav.entity.NavCategory;
import com.vc.nav.service.NavCategoryService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 导航分类接口（iTab 右侧竖栏分类）。
 */
@RestController
@RequestMapping("/nav/categories")
@RequiredArgsConstructor
public class NavCategoryController {

    private final NavCategoryService categoryService;

    /** 1. 列出当前用户所有分类（按 sort_order 升序） */
    @GetMapping
    public BaseResponse<List<NavCategory>> list() {
        return ResultUtils.success(categoryService.list(currentUserId()));
    }

    /** 2. 新建分类 */
    @PostMapping
    public BaseResponse<Long> create(@Valid @RequestBody CategoryCreateRequest req) {
        return ResultUtils.success(categoryService.create(currentUserId(), req));
    }

    /** 3. 更新分类（重命名 / 改图标） */
    @PutMapping("/{id}")
    public BaseResponse<Void> update(@PathVariable Long id, @Valid @RequestBody CategoryUpdateRequest req) {
        categoryService.update(currentUserId(), id, req);
        return ResultUtils.success(null);
    }

    /** 4. 删除分类（分类下有书签时拒绝删除） */
    @DeleteMapping("/{id}")
    public BaseResponse<Void> delete(@PathVariable Long id) {
        categoryService.delete(currentUserId(), id);
        return ResultUtils.success(null);
    }

    /** 5. 批量排序 */
    @PutMapping("/reorder")
    public BaseResponse<Void> reorder(@RequestBody CategoryReorderRequest req) {
        categoryService.reorder(currentUserId(), req);
        return ResultUtils.success(null);
    }

    /** 6. 设为默认分类 */
    @PutMapping("/{id}/default")
    public BaseResponse<Void> setDefault(@PathVariable Long id) {
        categoryService.setDefault(currentUserId(), id);
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
