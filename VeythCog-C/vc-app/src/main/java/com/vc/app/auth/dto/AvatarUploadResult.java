package com.vc.app.auth.dto;

/**
 * 头像上传结果。
 *
 * @param avatarKey S3 对象 key，落库用
 * @param avatarUrl S3 公开直链，前端预览用
 */
public record AvatarUploadResult(String avatarKey, String avatarUrl) {
}
