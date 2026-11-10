package com.vc.common.s3;

import java.util.Map;
import java.util.Set;

import com.vc.common.s3.exception.StorageValidationException;

/**
 * 文件基础校验工具：后缀白名单、MIME 白名单、扩展名与真实类型一致性。
 *
 * <p>这里不内置任何业务白名单 —— 允许哪些后缀、哪些大小由业务模块传入并自行控制，
 * 公共库只提供"判断能力"，避免把壁纸/图标的专属规则固化进 vc-common。</p>
 *
 * <p>真实类型靠文件头魔数识别（jpg / png / gif / webp / bmp / ico），
 * <b>svg 是文本格式没有魔数</b>，只能按后缀与 MIME 判断，业务侧若要开放 svg
 * 需自行考虑脚本注入风险（公开桶建议直接禁止 svg）。</p>
 *
 * <p>典型用法（业务上传接口内）：</p>
 * <pre>
 * S3FileValidator.validate(filename, contentType, contentHead,
 *         Set.of("png", "jpg", "jpeg", "webp"),
 *         Set.of("image/png", "image/jpeg", "image/webp"));
 * </pre>
 */
public final class S3FileValidator {

    /** 常见图片后缀 → MIME 映射（仅用于一致性校验与类型推导） */
    private static final Map<String, String> EXTENSION_MIME = Map.of(
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "png", "image/png",
            "gif", "image/gif",
            "webp", "image/webp",
            "bmp", "image/bmp",
            "ico", "image/x-icon",
            "svg", "image/svg+xml");

    private S3FileValidator() {
    }

    /**
     * 根据文件名推导 MIME 类型。
     *
     * @return 常见图片类型的 MIME；无法识别返回 null
     */
    public static String mimeTypeOf(String filename) {
        String extension = S3ObjectKeyUtils.extensionOf(filename);
        return extension.isEmpty() ? null : EXTENSION_MIME.get(extension);
    }

    /**
     * 判断后缀是否在允许集合内（忽略大小写）。
     *
     * @param allowedExtensions 允许的后缀集合，null 或空表示不限制
     */
    public static boolean isExtensionAllowed(String filename, Set<String> allowedExtensions) {
        if (allowedExtensions == null || allowedExtensions.isEmpty()) {
            return true;
        }
        String extension = S3ObjectKeyUtils.extensionOf(filename);
        if (extension.isEmpty()) {
            return false;
        }
        return containsIgnoreCase(allowedExtensions, extension);
    }

    /**
     * 判断 MIME 是否在允许集合内（忽略大小写与 charset 后缀，如 {@code image/png; charset=x}）。
     *
     * @param allowedContentTypes 允许的 MIME 集合，null 或空表示不限制
     */
    public static boolean isContentTypeAllowed(String contentType, Set<String> allowedContentTypes) {
        if (allowedContentTypes == null || allowedContentTypes.isEmpty()) {
            return true;
        }
        String normalized = normalizeContentType(contentType);
        if (normalized == null) {
            return false;
        }
        return containsIgnoreCase(allowedContentTypes, normalized);
    }

    /**
     * 通过文件头魔数识别真实类型。
     *
     * @param contentHead 文件前若干字节（建议 16 字节以上），可为 null
     * @return 识别到的 MIME；无法识别返回 null（如 svg、非图片文件）
     */
    public static String detectMimeType(byte[] contentHead) {
        if (contentHead == null || contentHead.length < 4) {
            return null;
        }
        if (startsWith(contentHead, new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})) {
            return "image/jpeg";
        }
        if (startsWith(contentHead, new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A})) {
            return "image/png";
        }
        if (startsWith(contentHead, new byte[]{'G', 'I', 'F', '8'})) {
            return "image/gif";
        }
        if (contentHead.length >= 12
                && startsWith(contentHead, new byte[]{'R', 'I', 'F', 'F'})
                && contentHead[8] == 'W' && contentHead[9] == 'E'
                && contentHead[10] == 'B' && contentHead[11] == 'P') {
            return "image/webp";
        }
        if (startsWith(contentHead, new byte[]{'B', 'M'})) {
            return "image/bmp";
        }
        if (startsWith(contentHead, new byte[]{0x00, 0x00, 0x01, 0x00})) {
            return "image/x-icon";
        }
        return null;
    }

    /**
     * 综合校验：后缀白名单 + MIME 白名单 + 扩展名与真实类型一致。
     *
     * @param filename           原始文件名（取后缀）
     * @param declaredContentType 客户端声明的 MIME，可为 null（为空时跳过声明类型校验）
     * @param contentHead        文件头字节，用于魔数识别，可为 null（为空时跳过真实类型校验）
     * @param allowedExtensions  允许的后缀集合，null/空表示不限制
     * @param allowedContentTypes 允许的 MIME 集合，null/空表示不限制
     * @throws StorageValidationException 任一校验不通过
     */
    public static void validate(String filename, String declaredContentType, byte[] contentHead,
                                Set<String> allowedExtensions, Set<String> allowedContentTypes) {
        if (filename == null || filename.trim().isEmpty()) {
            throw new StorageValidationException("文件名不能为空");
        }
        String extension = S3ObjectKeyUtils.extensionOf(filename);
        if (extension.isEmpty()) {
            throw new StorageValidationException("文件缺少可识别的扩展名：" + filename);
        }
        if (!isExtensionAllowed(filename, allowedExtensions)) {
            throw new StorageValidationException("不支持的文件后缀：." + extension);
        }
        String normalizedDeclared = normalizeContentType(declaredContentType);
        if (normalizedDeclared != null && !isContentTypeAllowed(normalizedDeclared, allowedContentTypes)) {
            throw new StorageValidationException("不支持的文件类型：" + normalizedDeclared);
        }
        String magicType = detectMimeType(contentHead);
        if (magicType == null) {
            // 无魔数（如 svg）：只能用声明类型与后缀推导做兜底
            return;
        }
        if (allowedContentTypes != null && !allowedContentTypes.isEmpty()
                && !containsIgnoreCase(allowedContentTypes, magicType)) {
            throw new StorageValidationException("文件真实类型不在允许范围：" + magicType);
        }
        String expectedType = EXTENSION_MIME.get(extension);
        if (expectedType != null && !expectedType.equalsIgnoreCase(magicType)) {
            throw new StorageValidationException(
                    "文件真实类型(" + magicType + ")与扩展名(." + extension + ")不一致");
        }
    }

    /** 去掉 ";charset=..." 等参数并转小写 */
    private static String normalizeContentType(String contentType) {
        if (contentType == null || contentType.trim().isEmpty()) {
            return null;
        }
        String value = contentType.trim();
        int semicolon = value.indexOf(';');
        if (semicolon >= 0) {
            value = value.substring(0, semicolon);
        }
        return value.trim().toLowerCase();
    }

    private static boolean containsIgnoreCase(Set<String> allowed, String candidate) {
        for (String item : allowed) {
            if (item != null && item.trim().equalsIgnoreCase(candidate)) {
                return true;
            }
        }
        return false;
    }

    private static boolean startsWith(byte[] source, byte[] prefix) {
        if (source.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (source[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
