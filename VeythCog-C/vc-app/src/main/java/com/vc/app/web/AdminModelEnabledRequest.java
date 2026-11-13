package com.vc.app.web;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 模型上架 / 下架请求。
 */
@Data
public class AdminModelEnabledRequest {

    @NotNull(message = "enabled 不能为空")
    private Boolean enabled;
}
