package com.vc.app.admin.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 管理员编辑用户请求（PUT /admin/users/{id}）。
 * 仅更新昵称 / 邮箱 / 角色；用户名与状态不允许在此修改。
 */
@Data
public class UpdateUserRequest implements Serializable {

    private String nickname;

    private String email;

    /** admin / user */
    private String role;
}
