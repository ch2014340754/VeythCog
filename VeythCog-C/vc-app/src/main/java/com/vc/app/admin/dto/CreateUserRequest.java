package com.vc.app.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.io.Serializable;

/**
 * 管理员新建用户请求（POST /admin/users）。
 */
@Data
public class CreateUserRequest implements Serializable {

    @NotBlank(message = "用户名不能为空")
    private String username;

    private String nickname;

    private String email;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, message = "密码至少 6 位")
    private String password;

    /** admin / user，缺省 user */
    private String role = "user";
}
