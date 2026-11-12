package com.vc.app.auth.controller;

import com.vc.app.auth.dto.AvatarUploadResult;
import com.vc.app.auth.dto.LoginRequest;
import com.vc.app.auth.dto.LoginResponse;
import com.vc.app.auth.dto.RegisterRequest;
import com.vc.app.auth.dto.UserProfileResponse;
import com.vc.app.auth.service.AuthService;
import com.vc.app.auth.service.AvatarService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Resource
    private AuthService authService;

    @Resource
    private AvatarService avatarService;

    @PostMapping("/login")
    public BaseResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResultUtils.success(authService.login(request));
    }

    @PostMapping("/register")
    public BaseResponse<Long> register(@Valid @RequestBody RegisterRequest request) {
        return ResultUtils.success(authService.register(request));
    }

    /** 当前用户资料：前端刷新头像 / 昵称用 */
    @GetMapping("/me")
    public BaseResponse<UserProfileResponse> me() {
        return ResultUtils.success(authService.me(currentUserId()));
    }

    /** 上传头像：PNG / JPEG / WebP，≤2MB */
    @PostMapping("/avatar")
    public BaseResponse<AvatarUploadResult> uploadAvatar(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请选择头像图片");
        }
        try {
            return ResultUtils.success(avatarService.upload(
                    currentUserId(), file.getBytes(), file.getOriginalFilename(), file.getContentType()));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "读取头像文件失败");
        }
    }

    /** 恢复默认头像：清除 DB 绑定并删除旧 S3 对象 */
    @DeleteMapping("/avatar")
    public BaseResponse<Boolean> deleteAvatar() {
        avatarService.delete(currentUserId());
        return ResultUtils.success(true);
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
