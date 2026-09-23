package com.vc.vcchat.auth.controller;

import com.vc.vcchat.auth.dto.LoginRequest;
import com.vc.vcchat.auth.dto.LoginResponse;
import com.vc.vcchat.auth.dto.RegisterRequest;
import com.vc.vcchat.auth.service.AuthService;
import com.vc.vccode.common.BaseResponse;
import com.vc.vccode.common.ResultUtils;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Resource
    private AuthService authService;

    @PostMapping("/login")
    public BaseResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResultUtils.success(authService.login(request));
    }

    @PostMapping("/register")
    public BaseResponse<Long> register(@Valid @RequestBody RegisterRequest request) {
        return ResultUtils.success(authService.register(request));
    }
}
