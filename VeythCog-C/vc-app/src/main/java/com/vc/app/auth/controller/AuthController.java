package com.vc.app.auth.controller;

import com.vc.app.auth.dto.LoginRequest;
import com.vc.app.auth.dto.LoginResponse;
import com.vc.app.auth.dto.RegisterRequest;
import com.vc.app.auth.service.AuthService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
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
