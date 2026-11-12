package com.vc.app.auth.service;

import com.vc.app.auth.dto.AvatarUploadResult;

/**
 * 用户头像服务：上传到 S3、绑定 avatarKey、生成展示直链。
 */
public interface AvatarService {

    /**
     * 上传并替换当前用户头像。
     *
     * @param userId      当前登录用户
     * @param content     文件字节
     * @param filename    原始文件名（用于校验后缀与推导扩展名）
     * @param contentType 浏览器声明的 MIME，可为 null``
     */
    AvatarUploadResult upload(Long userId, byte[] content, String filename, String contentType);

    /**
     * 清除当前用户头像，并尝试删除旧 S3 对象。
     */
    void delete(Long userId);

    /**
     * 由 avatarKey 生成公开直链；空 key 返回 null。
     */
    String avatarUrl(String avatarKey);
}
