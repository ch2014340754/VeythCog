package com.vc.app.auth.controller;

import com.vc.app.auth.dto.AvatarUploadResult;
import com.vc.app.auth.dto.LoginRequest;
import com.vc.app.auth.dto.LoginResponse;
import com.vc.app.auth.dto.RegisterRequest;
import com.vc.app.auth.dto.UserProfileResponse;
import com.vc.app.auth.service.AuthService;
import com.vc.app.auth.service.AvatarService;
import com.vc.app.auth.jwt.JwtUtil;
import com.vc.admin.monitor.service.SessionService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
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

    @Resource
    private JwtUtil jwtUtil;

    @Resource
    private SessionService sessionService;

    @PostMapping("/login")
    public BaseResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                             HttpServletRequest servletRequest) {
        return ResultUtils.success(authService.login(request,
                clientIp(servletRequest), servletRequest.getHeader("User-Agent")));
    }

    /** 退出登录：把当前会话置 logout，JWT 立即失效 */
    @PostMapping("/logout")
    public BaseResponse<Boolean> logout(HttpServletRequest servletRequest) {
        String auth = servletRequest.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                sessionService.logout(jwtUtil.parseSessionId(auth.substring(7)));
            } catch (Exception ignored) {
                // token 已失效，登出无需报错
            }
        }
        return ResultUtils.success(true);
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

    /** 与 ApiAccessLogFilter 相同的取 IP 规则，保证会话列表里的 IP 与调用日志一致 */
    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String remote = request.getRemoteAddr();
        return "0:0:0:0:0:0:0:1".equals(remote) ? "127.0.0.1" : remote;
    }
}
