package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 绑定模型请求。
 */
@Data
public class BindRequest implements Serializable {

    @NotBlank(message = "vendor 不能为空")
    private String vendor;

    @NotBlank(message = "modelCode 不能为空")
    private String modelCode;

    /** 是否设为默认模型（可选） */
    private Boolean isDefault;
}
