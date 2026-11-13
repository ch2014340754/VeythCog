package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * 模型目录中的单个模型（管理页用）。
 */
@Data
@AllArgsConstructor
public class CatalogModelItem {

    private String modelCode;
    private String modelName;
    /** 主类型：text / reasoning / vision / omni / image / video / audio / embedding / other */
    private String modelType;
    /** 支持的全部模态（主类型也在其中） */
    private List<String> modalities;
    private Boolean bound;
    private Boolean isDefault;
    private Boolean enabled;
    /** 该模型是否已通过连通校验（与是否绑定无关） */
    private Boolean valid;
    /** 最近一次校验失败原因（通过或从未校验为 null） */
    private String verifyError;
}
