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

    /** 当前用户是否已配置自持 AK */
    private Boolean hasApiKey;

    /** 用户 AK 脱敏值（未配置为 null） */
    private String apiKeyMasked;

    /** 配置文件是否配置了兜底 AK */
    private Boolean hasFallbackKey;
}
