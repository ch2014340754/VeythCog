package com.vc.nav.dto;

import lombok.Data;

import java.util.List;

/**
 * 分类批量排序请求。
 */
@Data
public class CategoryReorderRequest {

    private List<ReorderItem> items;
}
