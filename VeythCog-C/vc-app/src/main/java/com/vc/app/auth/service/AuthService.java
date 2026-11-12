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
     * 登录
     */
    LoginResponse login(LoginRequest request);

    /**
     * 注册，返回用户 id
     */
    Long register(RegisterRequest request);

    /**
     * 当前用户资料（含头像直链）
     */
    UserProfileResponse me(Long userId);
}
