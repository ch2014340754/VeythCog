package com.vc.app.admin.controller;

import com.vc.app.admin.dto.AdminUserDto;
import com.vc.app.admin.dto.CreateUserRequest;
import com.vc.app.admin.dto.ResetPasswordRequest;
import com.vc.app.admin.dto.UpdateStatusRequest;
import com.vc.app.admin.dto.UpdateUserRequest;
import com.vc.app.admin.service.AdminUserService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin 用户管理接口。整个 {@code /admin/**} 已由 Security 限定为 admin 角色，
 * 非 admin 访问会得到 403「无权限」。
 */
@RestController
@RequestMapping("/admin/users")
public class AdminController {

    private final AdminUserService adminUserService;

    public AdminController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public BaseResponse<List<AdminUserDto>> list() {
        return ResultUtils.success(adminUserService.list());
    }

    @PostMapping
    public BaseResponse<Long> create(@Valid @RequestBody CreateUserRequest request) {
        return ResultUtils.success(adminUserService.create(request));
    }

    @PutMapping("/{id}")
    public BaseResponse<Boolean> update(@PathVariable Long id,
                                        @Valid @RequestBody UpdateUserRequest request) {
        adminUserService.update(id, request, currentUserId());
        return ResultUtils.success(true);
    }

    @PutMapping("/{id}/status")
    public BaseResponse<Boolean> updateStatus(@PathVariable Long id,
                                              @Valid @RequestBody UpdateStatusRequest request) {
        adminUserService.updateStatus(id, request, currentUserId());
        return ResultUtils.success(true);
    }

    @DeleteMapping("/{id}")
    public BaseResponse<Boolean> delete(@PathVariable Long id) {
        adminUserService.delete(id, currentUserId());
        return ResultUtils.success(true);
    }

    @PutMapping("/{id}/password")
    public BaseResponse<Boolean> resetPassword(@PathVariable Long id,
                                               @Valid @RequestBody ResetPasswordRequest request) {
        adminUserService.resetPassword(id, request);
        return ResultUtils.success(true);
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
