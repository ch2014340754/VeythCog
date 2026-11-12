package com.vc.app.auth.dto;

import lombok.Data;

import java.io.Serializable;

@Data
public class LoginResponse implements Serializable {

    /** JWT token */
    private String token;

    private String username;

    private String nickname;

    /** 头像 S3 公开直链；未设置时为 null */
    private String avatarUrl;

    /** 角色：admin / user */
    private String role;
}
