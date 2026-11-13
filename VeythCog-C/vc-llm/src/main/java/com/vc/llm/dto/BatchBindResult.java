package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * 批量绑定结果（供应商 → 多选模型 + 可选 AK）。
 */
@Data
@AllArgsConstructor
public class BatchBindResult {

    private String vendor;
    private List<String> modelCodes;
    private Boolean hasApiKey;
    private String apiKeyMasked;
}
