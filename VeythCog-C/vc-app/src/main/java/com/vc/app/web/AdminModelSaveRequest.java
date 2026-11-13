package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理端新增 / 编辑模型目录请求。
 */
@Data
public class AdminModelSaveRequest {

    @NotBlank(message = "vendor 不能为空")
    private String vendor;

    @NotBlank(message = "模型编码不能为空")
    @Size(max = 64, message = "模型编码不能超过 64 个字符")
    private String modelCode;

    @Size(max = 64, message = "模型名称不能超过 64 个字符")
    private String modelName;

    /** 上下文窗口，缺省 32768 */
    private Integer maxContextTokens;

    /** 默认温度，缺省 0.70 */
    private BigDecimal temperature;

    /** 是否上架，缺省 true */
    private Boolean enabled;
}
