package com.vc.app.auth.service.impl;

import com.vc.app.auth.dto.LoginRequest;
import com.vc.app.auth.dto.LoginResponse;
import com.vc.app.auth.dto.RegisterRequest;
import com.vc.app.auth.dto.UserProfileResponse;
import com.vc.app.auth.entity.Role;
import com.vc.app.auth.entity.User;
import com.vc.app.auth.jwt.JwtUtil;
import com.vc.app.auth.repository.RoleRepository;
import com.vc.app.auth.repository.UserRepository;
import com.vc.app.auth.service.AuthService;
import com.vc.app.auth.service.AvatarService;
import com.vc.app.auth.util.PasswordUtil;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 认证服务实现：基于 MySQL app_user 表 + BCrypt + JWT。
 */
@Slf4j
@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JwtUtil jwtUtil;
    private final AvatarService avatarService;

    public AuthServiceImpl(UserRepository userRepository, RoleRepository roleRepository,
                           JwtUtil jwtUtil, AvatarService avatarService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.jwtUtil = jwtUtil;
        this.avatarService = avatarService;
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "用户名或密码错误"));
        if (!PasswordUtil.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名或密码错误");
        }
        if ("disabled".equals(user.getStatus())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "该账号已被禁用，请联系管理员");
        }
        Set<String> roleCodes = user.getRoles() == null ? Set.of()
                : user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet());
        String primaryRole = primaryRole(roleCodes);

        LoginResponse resp = new LoginResponse();
        resp.setToken(jwtUtil.generate(user.getId(), user.getUsername(), roleCodes));
        resp.setUsername(user.getUsername());
        resp.setNickname(user.getNickname());
        resp.setAvatarUrl(avatarService.avatarUrl(user.getAvatarKey()));
        resp.setRole(primaryRole);
        log.info("登录成功，用户名：{}，角色：{}", user.getUsername(), roleCodes);
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
        user.setStatus("active");
        // 默认分配 user 角色
        Role userRole = roleRepository.findByCode("user")
                .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "系统角色未初始化"));
        user.setRoles(new HashSet<>(Set.of(userRole)));
        return userRepository.save(user).getId();
    }

    @Override
    public UserProfileResponse me(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "用户不存在"));
        Set<String> roleCodes = user.getRoles() == null ? Set.of()
                : user.getRoles().stream().map(Role::getCode).collect(Collectors.toSet());
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                user.getEmail(),
                avatarService.avatarUrl(user.getAvatarKey()),
                primaryRole(roleCodes));
    }

    private static String primaryRole(Set<String> roleCodes) {
        return roleCodes.contains("admin") ? "admin" : "user";
    }
}
