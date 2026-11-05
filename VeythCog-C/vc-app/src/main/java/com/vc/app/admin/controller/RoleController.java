package com.vc.app.admin.controller;

import com.vc.app.auth.entity.Role;
import com.vc.app.auth.repository.RoleRepository;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 角色管理接口。整个 {@code /admin/**} 已由 Security 限定为 admin 角色。
 */
@RestController
@RequestMapping("/admin/roles")
public class RoleController {

    private final RoleRepository roleRepository;

    public RoleController(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @GetMapping
    public BaseResponse<List<Role>> list() {
        return ResultUtils.success(roleRepository.findAll());
    }
}
