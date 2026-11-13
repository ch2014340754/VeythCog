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

    /** 用户保存的业务空间 ID（未保存为 null） */
    private String workspaceId;

    /** 用户保存的地域代码（未保存为 null） */
    private String region;

    /** 当前生效的业务空间 ID（用户保存 → 配置兜底） */
    private String effectiveWorkspaceId;

    /** 当前生效的地域代码 */
    private String effectiveRegion;

    /** 配置文件是否配置了兜底业务空间 */
    private Boolean hasFallbackWorkspace;

    /** 当前生效的调用根地址（含业务空间时为其专属域名） */
    private String effectiveBaseUrl;
}
