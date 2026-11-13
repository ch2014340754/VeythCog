package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * 我的绑定模型（对话页下拉用）。
 */
@Data
@AllArgsConstructor
public class LlmModelItem {

    private String vendor;
    private String modelCode;
    private String modelName;
    /** 主类型（前端展示类型图标） */
    private String modelType;
    /** 支持的全部模态（供下拉展示多个图标） */
    private List<String> modalities;
    private Boolean enabled;
    private Boolean isDefault;
}
