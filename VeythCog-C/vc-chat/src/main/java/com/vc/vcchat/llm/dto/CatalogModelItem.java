package com.vc.vcchat.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 模型目录中的单个模型（管理页用）。
 */
@Data
@AllArgsConstructor
public class CatalogModelItem {

    private String modelCode;
    private String modelName;
    private Boolean bound;
    private Boolean isDefault;
    private Boolean enabled;
}
