package com.vc.nav.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 书签批量排序请求。
 */
@Data
public class BookmarkReorderRequest {

    @NotNull(message = "分类 ID 不能为空")
    private Long categoryId;

    private List<ReorderItem> items;
}
