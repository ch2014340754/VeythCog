package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 供应商维度的 Key 状态（不含明文）。
 */
@Data
@AllArgsConstructor
public class VendorKeyStatus {

    /** 是否已配置用户自持 AK */
    private Boolean hasApiKey;

    /** 用户 AK 脱敏值（未配置为 null） */
    private String apiKeyMasked;

    /** 配置文件是否为该供应商配置了兜底 AK */
    private Boolean hasFallbackKey;
}
