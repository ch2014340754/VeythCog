package com.vc.app.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 启用 / 禁用用户请求（PUT /admin/users/{id}/status）。
 */
@Data
public class UpdateStatusRequest implements Serializable {

    @NotBlank(message = "状态不能为空")
    private String status;
}
