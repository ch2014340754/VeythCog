package com.vc.app.admin.service.impl;

import com.vc.app.admin.dto.AdminUserDto;
import com.vc.app.admin.dto.CreateUserRequest;
import com.vc.app.admin.dto.ResetPasswordRequest;
import com.vc.app.admin.dto.UpdateStatusRequest;
import com.vc.app.admin.dto.UpdateUserRequest;
import com.vc.app.admin.service.AdminUserService;
import com.vc.app.auth.entity.Role;
import com.vc.app.auth.entity.User;
import com.vc.app.auth.repository.RoleRepository;
import com.vc.app.auth.repository.UserRepository;
import com.vc.app.auth.util.PasswordUtil;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Admin 用户管理服务实现。含自我保护：不得删除 / 禁用 / 撤销当前登录账号的 admin 角色。
 * 角色为多对多：通过 user_role 关联表，根据 primary role（admin 优先）展示。
 */
@Service
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    public AdminUserServiceImpl(UserRepository userRepository, RoleRepository roleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }

    @Override
    public List<AdminUserDto> list() {
        return userRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Long create(CreateUserRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        if (username.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名不能为空");
        }
        if (userRepository.existsByUsername(username)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "用户名已存在");
        }
        User user = new User();
        user.setUsername(username);
        user.setPassword(PasswordUtil.encode(request.getPassword()));
        user.setNickname(request.getNickname() == null || request.getNickname().isBlank()
                ? username : request.getNickname());
        user.setEmail(request.getEmail() == null ? "" : request.getEmail());
        user.setStatus("active");
        // 根据 role 参数分配角色（多对多）
        String roleCode = normalizeRole(request.getRole());
        Set<Role> roles = new HashSet<>();
        roles.add(roleRepository.findByCode("user")
                .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "系统角色未初始化")));
        if ("admin".equals(roleCode)) {
            roles.add(roleRepository.findByCode("admin")
                    .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "系统角色未初始化")));
        }
        user.setRoles(roles);
        return userRepository.save(user).getId();
    }

    @Override
    @Transactional
    public void update(Long id, UpdateUserRequest request, Long operatorId) {
        User user = requireUser(id);
        if (id.equals(operatorId) && request.getRole() != null) {
            // 自我保护：不得撤销当前登录账号的 admin 角色
            String effectiveRole = normalizeRole(request.getRole());
            if (!"admin".equals(effectiveRole)) {
                throw new BusinessException(ErrorCode.FORBIDDEN_ERROR, "不能撤销当前登录账号的 admin 角色");
            }
        }
        if (request.getNickname() != null) {
            user.setNickname(request.getNickname().isBlank() ? user.getUsername() : request.getNickname());
        }
        if (request.getEmail() != null) {
            user.setEmail(request.getEmail());
        }
        if (request.getRole() != null) {
            String roleCode = normalizeRole(request.getRole());
            Set<Role> roles = new HashSet<>();
            roles.add(roleRepository.findByCode("user")
                    .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "系统角色未初始化")));
            if ("admin".equals(roleCode)) {
                roles.add(roleRepository.findByCode("admin")
                        .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "系统角色未初始化")));
            }
            user.setRoles(roles);
        }
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void updateStatus(Long id, UpdateStatusRequest request, Long operatorId) {
        User user = requireUser(id);
        String status = normalizeStatus(request.getStatus());
        if (id.equals(operatorId) && "disabled".equals(status)) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR, "不能禁用当前登录账号");
        }
        user.setStatus(status);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public void delete(Long id, Long operatorId) {
        User user = requireUser(id);
        if (id.equals(operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR, "不能删除当前登录账号");
        }
        userRepository.delete(user);
    }

    @Override
    @Transactional
    public void resetPassword(Long id, ResetPasswordRequest request) {
        User user = requireUser(id);
        user.setPassword(PasswordUtil.encode(request.getPassword()));
        userRepository.save(user);
    }

    private User requireUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "用户不存在"));
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "user";
        }
        String r = role.trim();
        if (!"admin".equals(r) && !"user".equals(r)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "非法角色：" + role);
        }
        return r;
    }

    private String normalizeStatus(String status) {
        String s = status == null ? "" : status.trim();
        if (!"active".equals(s) && !"disabled".equals(s)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "非法状态：" + status);
        }
        return s;
    }

    /** 从用户角色集合取 primary role：admin 优先，否则 user */
    private String primaryRole(User u) {
        if (u.getRoles() == null || u.getRoles().isEmpty()) {
            return "user";
        }
        boolean hasAdmin = u.getRoles().stream().anyMatch(r -> "admin".equals(r.getCode()));
        return hasAdmin ? "admin" : "user";
    }

    private AdminUserDto toDto(User u) {
        AdminUserDto dto = new AdminUserDto();
        dto.setId(u.getId());
        dto.setUsername(u.getUsername());
        dto.setNickname(u.getNickname());
        dto.setEmail(u.getEmail());
        dto.setRole(primaryRole(u));
        dto.setStatus("disabled".equals(u.getStatus()) ? "disabled" : "active");
        dto.setCreateTime(u.getCreateTime());
        return dto;
    }
}
