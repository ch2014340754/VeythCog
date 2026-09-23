package com.vc.vcchat.auth.service.impl;

import com.vc.vcchat.auth.dto.LoginRequest;
import com.vc.vcchat.auth.dto.LoginResponse;
import com.vc.vcchat.auth.dto.RegisterRequest;
import com.vc.vcchat.auth.entity.User;
import com.vc.vcchat.auth.jwt.JwtUtil;
import com.vc.vcchat.auth.repository.UserRepository;
import com.vc.vcchat.auth.service.AuthService;
import com.vc.vcchat.auth.util.PasswordUtil;
import com.vc.vccode.exception.BusinessException;
import com.vc.vccode.exception.ErrorCode;
import org.springframework.stereotype.Service;

/**
 * 认证服务实现：基于 MySQL app_user 表 + BCrypt + JWT。
 */
@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    public AuthServiceImpl(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "用户名或密码错误"));
        if (!PasswordUtil.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名或密码错误");
        }
        LoginResponse resp = new LoginResponse();
        resp.setToken(jwtUtil.generate(user.getId(), user.getUsername()));
        resp.setUsername(user.getUsername());
        resp.setNickname(user.getNickname());
        return resp;
    }

    @Override
    public Long register(RegisterRequest request) {
        userRepository.findByUsername(request.getUsername()).ifPresent(u -> {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名已存在");
        });
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(PasswordUtil.encode(request.getPassword()));
        user.setNickname(request.getNickname() == null || request.getNickname().isBlank()
                ? request.getUsername() : request.getNickname());
        return userRepository.save(user).getId();
    }
}
