package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * 供应商枚举 + 其下模型目录（管理页用）。
 */
@Data
@AllArgsConstructor
public class CatalogVendorItem {

    private String vendor;
    private String vendorName;
    private String baseUrl;
    private List<CatalogModelItem> models;
}
