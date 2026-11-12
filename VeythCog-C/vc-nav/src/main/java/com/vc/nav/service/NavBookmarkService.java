package com.vc.nav.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.nav.dto.BookmarkCreateRequest;
import com.vc.nav.dto.BookmarkReorderRequest;
import com.vc.nav.dto.BookmarkUpdateRequest;
import com.vc.nav.dto.BookmarkView;
import com.vc.nav.dto.NavIconView;
import com.vc.nav.dto.ReorderItem;
import com.vc.nav.entity.NavBookmark;
import com.vc.nav.entity.NavCategory;
import com.vc.nav.mapper.NavBookmarkMapper;
import com.vc.nav.mapper.NavCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
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

    /** 文字图标底色：支持 #RGB / #RRGGBB */
    private static final Pattern COLOR_PATTERN =
            Pattern.compile("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");

    /** 文字图标最多 3 个字符 */
    private static final int MAX_ICON_TEXT_CODE_POINTS = 3;

    private final NavBookmarkMapper bookmarkMapper;
    private final NavCategoryMapper categoryMapper;
    private final NavIconService iconService;

    /**
     * 列出某分类下的书签（按 sort_order 升序）。
     */
    public List<BookmarkView> list(Long userId, Long categoryId) {
        requireCategory(userId, categoryId);
        return bookmarkMapper.selectList(
                        new LambdaQueryWrapper<NavBookmark>()
                                .eq(NavBookmark::getCategoryId, categoryId)
                                .eq(NavBookmark::getUserId, userId)
                                .orderByAsc(NavBookmark::getSortOrder))
                .stream()
                .map(BookmarkView::from)
                .toList();
    }

    /**
     * 列出当前用户全部书签：搜索框做本地联想时一次拉取，避免按分类多次请求。
     */
    public List<BookmarkView> listAll(Long userId) {
        return bookmarkMapper.selectList(
                        new LambdaQueryWrapper<NavBookmark>()
                                .eq(NavBookmark::getUserId, userId)
                                .orderByAsc(NavBookmark::getCategoryId)
                                .orderByAsc(NavBookmark::getSortOrder))
                .stream()
                .map(BookmarkView::from)
                .toList();
    }

    /**
     * 解析书签图标地址（缓存优先，未命中查 DB 拼 S3 直链）。
     */
    public NavIconView resolveIcon(Long userId, Long bookmarkId) {
        return iconService.resolve(userId, bookmarkId);
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
        applyIconFields(bookmark, req.getIconType(), req.getIconKey(), req.getIconText(),
                req.getIconColor(), true, false);

        // 新书签排到末尾：max(sortOrder) + 10
        NavBookmark maxSort = bookmarkMapper.selectOne(
                new LambdaQueryWrapper<NavBookmark>()
                        .eq(NavBookmark::getCategoryId, req.getCategoryId())
                        .orderByDesc(NavBookmark::getSortOrder)
                        .last("LIMIT 1"));
        bookmark.setSortOrder(maxSort == null ? 10 : maxSort.getSortOrder() + 10);
        bookmarkMapper.insert(bookmark);

        // 只选了网址、没有手动取图：异步补一次站点图标
        if (NavBookmark.ICON_TYPE_AUTO.equals(bookmark.getIconType())
                && (bookmark.getIconKey() == null || bookmark.getIconKey().isBlank())) {
            iconService.syncOneAsync(bookmark);
        }
        return bookmark.getId();
    }

    /**
     * 更新书签。
     */
    public void update(Long userId, Long id, BookmarkUpdateRequest req) {
        NavBookmark bookmark = requireBookmark(userId, id);
        validateUrl(req.getUrl());
        boolean urlChanged = !bookmark.getUrl().equals(req.getUrl());

        bookmark.setTitle(req.getTitle());
        bookmark.setUrl(req.getUrl());
        if (req.getCategoryId() != null && !req.getCategoryId().equals(bookmark.getCategoryId())) {
            requireCategory(userId, req.getCategoryId());
            bookmark.setCategoryId(req.getCategoryId());
        }
        // iconType 不传 = 只改标题 / URL，图标原样保留
        if (req.getIconType() != null && !req.getIconType().isBlank()) {
            applyIconFields(bookmark, req.getIconType(), req.getIconKey(), req.getIconText(),
                    req.getIconColor(), false, urlChanged);
        }
        bookmarkMapper.updateById(bookmark);
        iconService.evict(bookmark.getId());

        if (NavBookmark.ICON_TYPE_AUTO.equals(bookmark.getIconType())
                && (bookmark.getIconKey() == null || bookmark.getIconKey().isBlank())) {
            iconService.syncOneAsync(bookmark);
        }
    }

    /**
     * 删除书签（软删除）。
     */
    public void delete(Long userId, Long id) {
        NavBookmark bookmark = requireBookmark(userId, id);
        bookmarkMapper.deleteById(bookmark);
        iconService.evict(bookmark.getId());
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

    /**
     * 把请求里的图标字段应用到实体上，并做业务校验。
     *
     * @param creating  新建：null iconType 默认 auto
     * @param urlChanged 更新时 URL 是否变化（auto 图标需要清空旧的 S3 key 重新抓）
     */
    private void applyIconFields(NavBookmark bookmark, String rawType, String iconKey,
                                 String iconText, String iconColor,
                                 boolean creating, boolean urlChanged) {
        String type = rawType == null || rawType.isBlank()
                ? (creating ? NavBookmark.ICON_TYPE_AUTO : null)
                : NavIconService.normalizeType(rawType, false);
        if (type == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标类型只支持 auto / upload / text");
        }

        switch (type) {
            case NavBookmark.ICON_TYPE_TEXT -> {
                String text = iconText == null ? "" : iconText.trim();
                if (text.isEmpty()) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR, "请填写图标文字");
                }
                if (text.codePointCount(0, text.length()) > MAX_ICON_TEXT_CODE_POINTS) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标文字最多 3 个字符");
                }
                String color = NavIconService.colorOrDefault(iconColor == null ? null : iconColor.trim());
                if (!COLOR_PATTERN.matcher(color).matches()) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标颜色格式不正确，应为 #RRGGBB");
                }
                bookmark.setIconType(type);
                bookmark.setIconText(text);
                bookmark.setIconColor(color);
                bookmark.setIconKey(null);
                bookmark.setIconSyncedAt(null);
            }
            case NavBookmark.ICON_TYPE_UPLOAD -> {
                String key = trimToNull(iconKey);
                if (key == null) {
                    // 编辑时允许沿用原有上传图标，不强制前端回传
                    if (!creating && NavBookmark.ICON_TYPE_UPLOAD.equals(bookmark.getIconType())
                            && bookmark.getIconKey() != null) {
                        key = bookmark.getIconKey();
                    } else {
                        throw new BusinessException(ErrorCode.PARAMS_ERROR, "请先上传图标图片");
                    }
                }
                iconService.requireIconObject(key);
                bookmark.setIconType(type);
                bookmark.setIconKey(key);
                bookmark.setIconText(null);
                bookmark.setIconColor(null);
                bookmark.setIconSyncedAt(OffsetDateTime.now());
            }
            case NavBookmark.ICON_TYPE_AUTO -> {
                String key = trimToNull(iconKey);
                bookmark.setIconType(type);
                bookmark.setIconText(null);
                bookmark.setIconColor(null);
                if (key != null) {
                    iconService.requireIconObject(key);
                    bookmark.setIconKey(key);
                    bookmark.setIconSyncedAt(OffsetDateTime.now());
                } else if (creating || urlChanged) {
                    // 新建 / 换了网址：清掉旧图标，交给同步任务重新抓
                    bookmark.setIconKey(null);
                    bookmark.setIconSyncedAt(null);
                }
                // URL 未变且没传 key：保留原有 icon_key / icon_synced_at
            }
            default -> throw new BusinessException(ErrorCode.PARAMS_ERROR, "图标类型不合法");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
