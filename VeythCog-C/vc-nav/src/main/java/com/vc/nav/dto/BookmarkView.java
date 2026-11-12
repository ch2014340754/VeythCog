package com.vc.nav.dto;

import com.vc.nav.entity.NavBookmark;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 书签列表视图：只暴露前端需要的字段。
 *
 * <p>不直接下发 S3 图标直链：图标地址由 {@code GET /nav/bookmarks/{id}/icon}
 * 按「缓存 → DB」解析，前端先查本地缓存再请求。</p>
 */
@Data
public class BookmarkView {

    private Long id;

    private Long categoryId;

    private Long userId;

    private String title;

    private String url;

    private Integer sortOrder;

    private String iconType;

    /** S3 对象 key：前端编辑时原样回传，避免「只改标题」丢掉上传图标 */
    private String iconKey;

    private String iconText;

    private String iconColor;

    private OffsetDateTime iconSyncedAt;

    /** 是否已有 S3 图标对象（前端据此决定要不要请求图标接口） */
    private Boolean hasIcon;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    public static BookmarkView from(NavBookmark bookmark) {
        BookmarkView view = new BookmarkView();
        view.setId(bookmark.getId());
        view.setCategoryId(bookmark.getCategoryId());
        view.setUserId(bookmark.getUserId());
        view.setTitle(bookmark.getTitle());
        view.setUrl(bookmark.getUrl());
        view.setSortOrder(bookmark.getSortOrder());
        view.setIconType(bookmark.getIconType());
        view.setIconKey(bookmark.getIconKey());
        view.setIconText(bookmark.getIconText());
        view.setIconColor(bookmark.getIconColor());
        view.setIconSyncedAt(bookmark.getIconSyncedAt());
        view.setHasIcon(bookmark.getIconKey() != null && !bookmark.getIconKey().isBlank());
        view.setCreatedAt(bookmark.getCreatedAt());
        view.setUpdatedAt(bookmark.getUpdatedAt());
        return view;
    }
}
