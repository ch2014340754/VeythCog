package com.vc.common.s3;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import com.vc.common.s3.exception.StorageValidationException;

/**
 * 对象 key 工具：拼接目录前缀、生成唯一 key、校验 key 合法性。
 *
 * <p>只做通用拼接与安全过滤，不含任何业务分类规则（如"壁纸放哪个目录"由业务层决定）。</p>
 *
 * <p>生成规则：{@code {prefix}/{yyyy}/{MM}/{dd}/{uuid}.{ext}}，
 * 用 UUID 而不是原始文件名，规避中文名、空格、特殊字符、重名覆盖与路径穿越问题；
 * 原始文件名建议由业务侧另存到数据库（下载时用预签名 URL 的 content-disposition 还原）。</p>
 */
public final class S3ObjectKeyUtils {

    private static final DateTimeFormatter DATE_PATH =
            DateTimeFormatter.ofPattern("yyyy/MM/dd");

    /** 对象 key 最大长度（S3 规范 1024 字节，这里按字符数保守限制） */
    private static final int MAX_KEY_LENGTH = 1024;

    private S3ObjectKeyUtils() {
    }

    /**
     * 生成对象 key。
     *
     * @param prefix           目录前缀，如 {@code icons} / {@code wallpaper/2026}，可为空
     * @param originalFilename 原始文件名，用于取扩展名并做安全过滤，可为空（为空则不带扩展名）
     * @return 形如 {@code icons/2026/11/10/3f2a...c1.png}
     */
    public static String buildKey(String prefix, String originalFilename) {
        StringBuilder key = new StringBuilder();
        String normalizedPrefix = normalizePrefix(prefix);
        if (!normalizedPrefix.isEmpty()) {
            key.append(normalizedPrefix).append('/');
        }
        key.append(LocalDate.now().format(DATE_PATH)).append('/');
        key.append(UUID.randomUUID().toString().replace("-", ""));
        String extension = extensionOf(originalFilename);
        if (!extension.isEmpty()) {
            key.append('.').append(extension);
        }
        return key.toString();
    }

    /**
     * 取文件扩展名（小写、只保留字母数字，最长 10 位），无法识别时返回空串。
     */
    public static String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        String name = filename.trim();
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        String extension = name.substring(dot + 1).toLowerCase();
        StringBuilder sanitized = new StringBuilder(extension.length());
        for (char c : extension.toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
                sanitized.append(c);
            }
        }
        if (sanitized.length() == 0 || sanitized.length() > 10) {
            return "";
        }
        return sanitized.toString();
    }

    /**
     * 校验对象 key：非空、不以 "/" 开头、不含 {@code ..}、不含控制字符、长度不超限。
     *
     * @return 去掉首尾空白后的 key
     * @throws StorageValidationException key 非法
     */
    public static String requireValidKey(String objectKey) {
        if (objectKey == null || objectKey.trim().isEmpty()) {
            throw new StorageValidationException("对象 key 不能为空");
        }
        String key = objectKey.trim();
        if (key.startsWith("/")) {
            throw new StorageValidationException("对象 key 不能以 / 开头：" + key);
        }
        if (key.contains("..")) {
            throw new StorageValidationException("对象 key 不能包含 ..：" + key);
        }
        if (key.length() > MAX_KEY_LENGTH) {
            throw new StorageValidationException("对象 key 长度不能超过 " + MAX_KEY_LENGTH + " 个字符");
        }
        for (char c : key.toCharArray()) {
            if (Character.isISOControl(c)) {
                throw new StorageValidationException("对象 key 不能包含控制字符");
            }
        }
        return key;
    }

    /** 前缀去掉首尾 "/"，并过滤空白与非法字符 */
    private static String normalizePrefix(String prefix) {
        if (prefix == null) {
            return "";
        }
        String trimmed = prefix.trim().replaceAll("/{2,}", "/");
        while (trimmed.startsWith("/")) {
            trimmed = trimmed.substring(1);
        }
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
