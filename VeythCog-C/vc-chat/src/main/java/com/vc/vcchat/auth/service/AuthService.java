package com.vc.vcchat.auth.service;

import com.vc.vcchat.auth.dto.LoginRequest;
import com.vc.vcchat.auth.dto.LoginResponse;
import com.vc.vcchat.auth.dto.RegisterRequest;

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
}
