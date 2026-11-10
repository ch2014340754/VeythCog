package com.vc.nav.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.nav.dto.CategoryCreateRequest;
import com.vc.nav.dto.CategoryReorderRequest;
import com.vc.nav.dto.CategoryUpdateRequest;
import com.vc.nav.dto.ReorderItem;
import com.vc.nav.entity.NavBookmark;
import com.vc.nav.entity.NavCategory;
import com.vc.nav.mapper.NavBookmarkMapper;
import com.vc.nav.mapper.NavCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 导航分类服务。
 */
@Service
@RequiredArgsConstructor
public class NavCategoryService {

    private final NavCategoryMapper categoryMapper;
    private final NavBookmarkMapper bookmarkMapper;

    /**
     * 列出当前用户所有分类（按 sort_order 升序）。
     */
    public List<NavCategory> list(Long userId) {
        return categoryMapper.selectList(
                new LambdaQueryWrapper<NavCategory>()
                        .eq(NavCategory::getUserId, userId)
                        .orderByAsc(NavCategory::getSortOrder));
    }

    /**
     * 新建分类。
     */
    public Long create(Long userId, CategoryCreateRequest req) {
        // 同名校验
        Long count = categoryMapper.selectCount(
                new LambdaQueryWrapper<NavCategory>()
                        .eq(NavCategory::getUserId, userId)
                        .eq(NavCategory::getName, req.getName()));
        if (count > 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "分类名已存在：" + req.getName());
        }
        NavCategory category = new NavCategory();
        category.setUserId(userId);
        category.setName(req.getName());
        category.setIcon(req.getIcon() == null ? "" : req.getIcon());
        // 新分类排到末尾：max(sortOrder) + 10
        NavCategory maxSort = categoryMapper.selectOne(
                new LambdaQueryWrapper<NavCategory>()
                        .eq(NavCategory::getUserId, userId)
                        .orderByDesc(NavCategory::getSortOrder)
                        .last("LIMIT 1"));
        category.setSortOrder(maxSort == null ? 10 : maxSort.getSortOrder() + 10);
        category.setIsDefault(false);
        categoryMapper.insert(category);
        return category.getId();
    }

    /**
     * 更新分类（重命名 / 改图标）。
     */
    public void update(Long userId, Long id, CategoryUpdateRequest req) {
        NavCategory category = requireCategory(userId, id);
        category.setName(req.getName());
        if (req.getIcon() != null) {
            category.setIcon(req.getIcon());
        }
        categoryMapper.updateById(category);
    }

    /**
     * 删除分类（软删除）。
     * 分类下有书签时拒绝删除（409），必须先清空书签。
     */
    @Transactional
    public void delete(Long userId, Long id) {
        NavCategory category = requireCategory(userId, id);
        // 检查分类下是否有未删除的书签
        Long bookmarkCount = bookmarkMapper.selectCount(
                new LambdaQueryWrapper<NavBookmark>()
                        .eq(NavBookmark::getCategoryId, id)
                        .eq(NavBookmark::getUserId, userId));
        if (bookmarkCount > 0) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR,
                    "该分类下还有 " + bookmarkCount + " 个书签，请先清空后再删除");
        }
        categoryMapper.deleteById(category);
    }

    /**
     * 批量排序。
     */
    public void reorder(Long userId, CategoryReorderRequest req) {
        if (req.getItems() == null || req.getItems().isEmpty()) {
            return;
        }
        for (ReorderItem item : req.getItems()) {
            NavCategory category = requireCategory(userId, item.getId());
            category.setSortOrder(item.getSortOrder());
            categoryMapper.updateById(category);
        }
    }

    /**
     * 设为默认分类（应用层保证每用户至多 1 个）。
     */
    @Transactional
    public void setDefault(Long userId, Long id) {
        requireCategory(userId, id);
        // 先清同用户其他默认
        categoryMapper.update(null,
                new LambdaUpdateWrapper<NavCategory>()
                        .eq(NavCategory::getUserId, userId)
                        .set(NavCategory::getIsDefault, false));
        // 再设当前
        categoryMapper.update(null,
                new LambdaUpdateWrapper<NavCategory>()
                        .eq(NavCategory::getId, id)
                        .set(NavCategory::getIsDefault, true));
    }

    private NavCategory requireCategory(Long userId, Long id) {
        NavCategory category = categoryMapper.selectById(id);
        if (category == null || !category.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "分类不存在或无权限");
        }
        return category;
    }
}
