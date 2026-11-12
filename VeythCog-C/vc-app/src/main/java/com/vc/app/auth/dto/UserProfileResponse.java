package com.vc.app.auth.dto;

/**
 * 当前用户资料。
 *
 * @param avatarUrl 头像公开直链；未设置头像时为 null
 */
public record UserProfileResponse(
        Long id,
        String username,
        String nickname,
        String email,
        String avatarUrl,
        String role) {
}
