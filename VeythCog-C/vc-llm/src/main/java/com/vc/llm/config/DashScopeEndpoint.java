package com.vc.llm.config;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 百炼地域 / 业务空间地址拼装。
 *
 * <p>标准地址：{@code https://dashscope.aliyuncs.com}；指定业务空间后：
 * {@code https://{workspaceId}.{region}.maas.aliyuncs.com}。</p>
 *
 * <p>workspaceId / region 会进入域名，必须严格白名单校验，避免拼接成任意地址。</p>
 */
public final class DashScopeEndpoint {

    public static final String DEFAULT_BASE = "https://dashscope.aliyuncs.com";
    public static final String DEFAULT_REGION = "cn-beijing";

    private static final Pattern WORKSPACE_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$");
    private static final Pattern REGION_PATTERN = Pattern.compile("^[a-z0-9][a-z0-9-]{0,31}$");

    private DashScopeEndpoint() {
    }

    /** 空值返回 null；非法字符直接拒绝（防 SSRF / 非法域名） */
    public static String normalizeWorkspace(String workspaceId) {
        if (!StringUtils.hasText(workspaceId)) {
            return null;
        }
        String value = workspaceId.trim();
        if (!WORKSPACE_PATTERN.matcher(value).matches()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "业务空间 ID 格式不正确：仅允许字母、数字、下划线、短横线，最长 64 位");
        }
        return value;
    }

    /** 空值返回 null；统一小写并校验地域代码 */
    public static String normalizeRegion(String region) {
        if (!StringUtils.hasText(region)) {
            return null;
        }
        String value = region.trim().toLowerCase(Locale.ROOT);
        if (!REGION_PATTERN.matcher(value).matches()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "地域代码格式不正确：示例 cn-beijing");
        }
        return value;
    }

    public static String regionOrDefault(String region) {
        String normalized = normalizeRegion(region);
        return normalized == null ? DEFAULT_REGION : normalized;
    }

    /**
     * 实际调用根地址（不含 /api/v1 等业务路径）。
     *
     * @param vendor        供应商编码
     * @param configuredBase 配置文件中的 base-url（可空）
     * @param workspaceId   业务空间 ID（可空）
     * @param region        地域代码（可空，默认 cn-beijing）
     */
    public static String baseUrl(String vendor, String configuredBase, String workspaceId, String region) {
        if (!"dashscope".equalsIgnoreCase(vendor)) {
            return trimTrailingSlash(configuredBase);
        }
        String workspace = normalizeWorkspace(workspaceId);
        if (workspace == null) {
            String base = StringUtils.hasText(configuredBase) ? configuredBase : DEFAULT_BASE;
            return stripCompatibleSuffix(base);
        }
        return "https://" + workspace + "." + regionOrDefault(region) + ".maas.aliyuncs.com";
    }

    /** 去掉可能配置的 OpenAI 兼容后缀，得到原生根地址 */
    public static String stripCompatibleSuffix(String baseUrl) {
        String base = trimTrailingSlash(baseUrl);
        if (base == null) {
            return DEFAULT_BASE;
        }
        if (base.endsWith("/compatible-mode/v1")) {
            base = base.substring(0, base.length() - "/compatible-mode/v1".length());
        } else if (base.endsWith("/compatible-mode")) {
            base = base.substring(0, base.length() - "/compatible-mode".length());
        }
        return base;
    }

    /**
     * 百炼对话使用的 OpenAI 兼容根地址（含 /v1）。
     *
     * <p>原生 {@code /api/v1/services/aigc/text-generation/generation} 只覆盖老模型；
     * Qwen3.8 系列等新模型在该路径返回 {@code url error}，但兼容接口可用。
     * 标准域名与业务空间域名都支持 {@code /compatible-mode/v1}。</p>
     */
    public static String compatibleModeBaseUrl(String baseUrl) {
        String base = trimTrailingSlash(baseUrl);
        if (base == null) {
            base = DEFAULT_BASE;
        }
        if (base.endsWith("/compatible-mode/v1")) {
            return base;
        }
        if (base.endsWith("/compatible-mode")) {
            return base + "/v1";
        }
        return base + "/compatible-mode/v1";
    }

    private static String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }
}
