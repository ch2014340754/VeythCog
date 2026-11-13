package com.vc.app.auth.service;

import com.vc.app.auth.dto.LoginRequest;
import com.vc.app.auth.dto.LoginResponse;
import com.vc.app.auth.dto.RegisterRequest;
import com.vc.app.auth.dto.UserProfileResponse;

/**
 * 认证服务
 */
public interface AuthService {

    /**
     * 登录：创建服务端会话（sid 写进 JWT），用于在线会话与强制下线
     *
     * @param ip        客户端 IP
     * @param userAgent 客户端 UA
     */
    LoginResponse login(LoginRequest request, String ip, String userAgent);

    /**
     * 注册，返回用户 id
     */
    Long register(RegisterRequest request);

    /**
     * 当前用户资料（含头像直链）
     */
    UserProfileResponse me(Long userId);
}
