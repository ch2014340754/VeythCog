package com.vc.app.admin.dto;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 管理员视角的用户列表项（GET /admin/users）。
 */
@Data
public class AdminUserDto implements Serializable {

    private Long id;

    private String username;

    private String nickname;

    private String email;

    /** admin / user */
    private String role;

    /** active / disabled */
    private String status;

    private LocalDateTime createTime;
}
