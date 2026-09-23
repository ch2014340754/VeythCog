package com.vc.vcchat.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 我的绑定模型（对话页下拉用）。
 */
@Data
@AllArgsConstructor
public class LlmModelItem {

    private String vendor;
    private String modelCode;
    private String modelName;
    private Boolean enabled;
    private Boolean isDefault;
}
