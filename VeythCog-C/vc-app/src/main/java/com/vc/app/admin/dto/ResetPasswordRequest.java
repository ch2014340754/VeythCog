package com.vc.app.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.io.Serializable;

/**
 * 重置密码请求（PUT /admin/users/{id}/password）。
 */
@Data
public class ResetPasswordRequest implements Serializable {

    @NotBlank(message = "新密码不能为空")
    @Size(min = 6, message = "新密码至少 6 位")
    private String password;
}
