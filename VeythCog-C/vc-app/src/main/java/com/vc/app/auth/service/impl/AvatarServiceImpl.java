package com.vc.app.auth.service.impl;

import com.vc.app.auth.dto.AvatarUploadResult;
import com.vc.app.auth.entity.User;
import com.vc.app.auth.repository.UserRepository;
import com.vc.app.auth.service.AvatarService;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3Bucket;
import com.vc.common.s3.S3FileValidator;
import com.vc.common.s3.S3ObjectKeyUtils;
import com.vc.common.s3.S3PresignService;
import com.vc.common.s3.S3StorageClient;
import com.vc.common.s3.exception.StorageException;
import com.vc.common.s3.exception.StorageValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/**
 * 头像存储：复用 public-icons 公开桶，按 avatars/{userId}/ 隔离。
 *
 * <p>库里只存对象 key，展示时按当前 storage.s3.public-endpoint 生成直链，
 * 避免公网域名调整后旧 URL 失效。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AvatarServiceImpl implements AvatarService {

    /** 头像目录前缀；对象 key 形如 avatars/12/2026/11/12/xxx.png */
    private static final String AVATAR_PREFIX = "avatars";

    /** 头像大小上限：2MB */
    private static final int MAX_AVATAR_BYTES = 2 * 1024 * 1024;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp");

    private static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/png", "image/jpeg", "image/webp");

    private final UserRepository userRepository;
    private final S3StorageClient storageClient;
    private final S3PresignService presignService;

    @Override
    public AvatarUploadResult upload(Long userId, byte[] content, String filename, String contentType) {
        if (content == null || content.length == 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请选择头像图片");
        }
        if (content.length > MAX_AVATAR_BYTES) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "头像不能超过 2MB");
        }

        byte[] head = Arrays.copyOf(content, Math.min(16, content.length));
        String detectedMime = S3FileValidator.detectMimeType(head);
        if (detectedMime == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "头像仅支持 PNG / JPEG / WebP 图片");
        }
        if (!ALLOWED_CONTENT_TYPES.contains(detectedMime)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "头像仅支持 PNG / JPEG / WebP 图片");
        }

        String safeFilename = filename == null || filename.isBlank() ? "avatar.png" : filename.trim();
        if (S3ObjectKeyUtils.extensionOf(safeFilename).isEmpty()) {
            safeFilename = "avatar." + extensionForMime(detectedMime);
        }
        String declaredType = normalizeContentType(contentType);
        try {
            S3FileValidator.validate(safeFilename, declaredType, head, ALLOWED_EXTENSIONS, ALLOWED_CONTENT_TYPES);
        } catch (StorageValidationException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, e.getMessage());
        }

        User user = requireUser(userId);
        String key = S3ObjectKeyUtils.buildKey(AVATAR_PREFIX + "/" + userId, safeFilename);
        try {
            storageClient.upload(S3Bucket.PUBLIC_ICONS, key, content, detectedMime);
        } catch (StorageValidationException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, e.getMessage());
        } catch (StorageException e) {
            log.warn("上传头像失败 userId={} key={}：{}", userId, key, e.getMessage());
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "头像上传失败，请稍后重试");
        }

        String oldKey = user.getAvatarKey();
        user.setAvatarKey(key);
        userRepository.save(user);

        // 替换头像后清理旧对象；失败不影响新头像生效
        if (oldKey != null && !oldKey.isBlank() && !oldKey.equals(key) && oldKey.startsWith(AVATAR_PREFIX + "/")) {
            safeDelete(oldKey);
        }
        return new AvatarUploadResult(key, publicUrl(key));
    }

    @Override
    public void delete(Long userId) {
        User user = requireUser(userId);
        String oldKey = user.getAvatarKey();
        user.setAvatarKey("");
        userRepository.save(user);
        if (oldKey != null && !oldKey.isBlank() && oldKey.startsWith(AVATAR_PREFIX + "/")) {
            safeDelete(oldKey);
        }
    }

    @Override
    public String avatarUrl(String avatarKey) {
        if (avatarKey == null || avatarKey.isBlank()) {
            return null;
        }
        try {
            return publicUrl(avatarKey);
        } catch (Exception e) {
            log.warn("生成头像直链失败 key={}：{}", avatarKey, e.getMessage());
            return null;
        }
    }

    private User requireUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "用户不存在"));
    }

    private String publicUrl(String key) {
        return presignService.publicUrl(S3Bucket.PUBLIC_ICONS, key);
    }

    private void safeDelete(String key) {
        try {
            storageClient.delete(S3Bucket.PUBLIC_ICONS, key);
        } catch (Exception e) {
            log.warn("删除旧头像失败 key={}：{}", key, e.getMessage());
        }
    }

    private static String extensionForMime(String mime) {
        return switch (mime) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
    }

    /** 去掉 charset；application/octet-stream 等不可信声明按 null 处理 */
    private static String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        String normalized = contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || "application/octet-stream".equals(normalized)) {
            return null;
        }
        if ("image/jpg".equals(normalized)) {
            return "image/jpeg";
        }
        return normalized;
    }
}
