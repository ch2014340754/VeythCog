package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 管理端模型目录条目（含绑定引用数，便于删除前判断）。
 */
@Data
@AllArgsConstructor
public class AdminModelItem {

    private Long id;
    private String vendor;
    private String vendorName;
    private String modelCode;
    private String modelName;
    /** 主类型：text / reasoning / vision / omni / image / video / audio / embedding / other */
    private String modelType;
    /** 支持的全部模态（主类型也在其中） */
    private List<String> modalities;
    private Integer maxContextTokens;
    private BigDecimal temperature;
    /** 是否上架（上架后用户可见并可绑定） */
    private Boolean enabled;
    /** 当前被多少条用户绑定引用 */
    private Long bindingCount;
}
