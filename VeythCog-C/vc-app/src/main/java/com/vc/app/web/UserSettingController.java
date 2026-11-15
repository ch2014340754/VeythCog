package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.user.setting.UserSettingService;
import com.vc.user.setting.dto.UserSettingPatch;
import com.vc.user.setting.dto.UserSettingView;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户偏好统一接口（user_setting）。
 *
 * <p>所有「按用户保存的偏好」都通过这两个接口读写；后续新增偏好只加字段，
 * 不再新增接口/表（新增字段时同步扩展 {@link UserSettingPatch}）。</p>
 */
@RestController
@RequestMapping("/user/setting")
@RequiredArgsConstructor
public class UserSettingController {

    private final UserSettingService settingService;

    /** 读取当前用户偏好（行不存在时返回默认视图，不落库） */
    @GetMapping
    public BaseResponse<UserSettingView> get() {
        return ResultUtils.success(settingService.get(currentUserId()));
    }

    /** 局部更新当前用户偏好：null / 省略 = 不改；clear 数组中的字段置 NULL */
    @PutMapping
    public BaseResponse<UserSettingView> update(@RequestBody UserSettingPatch patch) {
        return ResultUtils.success(settingService.patch(currentUserId(), patch));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
