package com.vc.app.admin.service;

import com.vc.app.admin.dto.AdminUserDto;
import com.vc.app.admin.dto.CreateUserRequest;
import com.vc.app.admin.dto.ResetPasswordRequest;
import com.vc.app.admin.dto.UpdateStatusRequest;
import com.vc.app.admin.dto.UpdateUserRequest;

import java.util.List;

/**
 * Admin 用户管理服务：列表 / 新建 / 编辑 / 启停 / 删除 / 重置密码。
 * 所有操作仅由 admin 角色经 Security 授权后调用；operatorId 用于自我保护守卫。
 */
public interface AdminUserService {

    /** 全部用户列表 */
    List<AdminUserDto> list();

    /** 新建用户，返回新用户 id */
    Long create(CreateUserRequest request);

    /** 编辑昵称 / 邮箱 / 角色 */
    void update(Long id, UpdateUserRequest request, Long operatorId);

    /** 启用 / 禁用 */
    void updateStatus(Long id, UpdateStatusRequest request, Long operatorId);

    /** 删除用户 */
    void delete(Long id, Long operatorId);

    /** 重置密码 */
    void resetPassword(Long id, ResetPasswordRequest request);
}
