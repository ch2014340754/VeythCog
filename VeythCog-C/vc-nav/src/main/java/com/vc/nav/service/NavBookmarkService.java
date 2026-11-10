package com.vc.nav.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.nav.dto.BookmarkCreateRequest;
import com.vc.nav.dto.BookmarkReorderRequest;
import com.vc.nav.dto.BookmarkUpdateRequest;
import com.vc.nav.dto.ReorderItem;
import com.vc.nav.entity.NavBookmark;
import com.vc.nav.entity.NavCategory;
import com.vc.nav.mapper.NavBookmarkMapper;
import com.vc.nav.mapper.NavCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 导航书签服务。
 */
@Service
@RequiredArgsConstructor
public class NavBookmarkService {

    /** URL 白名单：仅允许 http/https */
    private static final Pattern URL_PATTERN = Pattern.compile("^https?://.+", Pattern.CASE_INSENSITIVE);

    private final NavBookmarkMapper bookmarkMapper;
    private final NavCategoryMapper categoryMapper;

    /**
     * 列出某分类下的书签（按 sort_order 升序）。
     */
    public List<NavBookmark> list(Long userId, Long categoryId) {
        requireCategory(userId, categoryId);
        return bookmarkMapper.selectList(
                new LambdaQueryWrapper<NavBookmark>()
                        .eq(NavBookmark::getCategoryId, categoryId)
                        .eq(NavBookmark::getUserId, userId)
                        .orderByAsc(NavBookmark::getSortOrder));
    }

    /**
     * 新建书签。
     */
    public Long create(Long userId, BookmarkCreateRequest req) {
        requireCategory(userId, req.getCategoryId());
        validateUrl(req.getUrl());
        NavBookmark bookmark = new NavBookmark();
        bookmark.setUserId(userId);
        bookmark.setCategoryId(req.getCategoryId());
        bookmark.setTitle(req.getTitle());
        bookmark.setUrl(req.getUrl());
        // 新书签排到末尾：max(sortOrder) + 10
        NavBookmark maxSort = bookmarkMapper.selectOne(
                new LambdaQueryWrapper<NavBookmark>()
                        .eq(NavBookmark::getCategoryId, req.getCategoryId())
                        .orderByDesc(NavBookmark::getSortOrder)
                        .last("LIMIT 1"));
        bookmark.setSortOrder(maxSort == null ? 10 : maxSort.getSortOrder() + 10);
        bookmarkMapper.insert(bookmark);
        return bookmark.getId();
    }

    /**
     * 更新书签。
     */
    public void update(Long userId, Long id, BookmarkUpdateRequest req) {
        NavBookmark bookmark = requireBookmark(userId, id);
        validateUrl(req.getUrl());
        bookmark.setTitle(req.getTitle());
        bookmark.setUrl(req.getUrl());
        if (req.getCategoryId() != null && !req.getCategoryId().equals(bookmark.getCategoryId())) {
            requireCategory(userId, req.getCategoryId());
            bookmark.setCategoryId(req.getCategoryId());
        }
        bookmarkMapper.updateById(bookmark);
    }

    /**
     * 删除书签（软删除）。
     */
    public void delete(Long userId, Long id) {
        NavBookmark bookmark = requireBookmark(userId, id);
        bookmarkMapper.deleteById(bookmark);
    }

    /**
     * 批量排序。
     */
    public void reorder(Long userId, BookmarkReorderRequest req) {
        requireCategory(userId, req.getCategoryId());
        if (req.getItems() == null || req.getItems().isEmpty()) {
            return;
        }
        for (ReorderItem item : req.getItems()) {
            NavBookmark bookmark = requireBookmark(userId, item.getId());
            if (!bookmark.getCategoryId().equals(req.getCategoryId())) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "书签不属于该分类");
            }
            bookmark.setSortOrder(item.getSortOrder());
            bookmarkMapper.updateById(bookmark);
        }
    }

    private void validateUrl(String url) {
        if (url == null || !URL_PATTERN.matcher(url).matches()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "URL 必须以 http:// 或 https:// 开头");
        }
    }

    private NavCategory requireCategory(Long userId, Long categoryId) {
        NavCategory category = categoryMapper.selectById(categoryId);
        if (category == null || !category.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "分类不存在或无权限");
        }
        return category;
    }

    private NavBookmark requireBookmark(Long userId, Long id) {
        NavBookmark bookmark = bookmarkMapper.selectById(id);
        if (bookmark == null || !bookmark.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "书签不存在或无权限");
        }
        return bookmark;
    }
}
