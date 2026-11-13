package com.vc.llm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * LLM 供应商 AK / baseUrl / 地域 / 业务空间配置（读取 llm.vendors.*）。
 * 后期迁移 Nacos 时，改为从配置中心注入即可，业务不变。
 */
@Data
@Component
@ConfigurationProperties(prefix = "llm.vendors")
public class LlmVendorProps {

    private VendorConfig dashscope = new VendorConfig();
    private VendorConfig deepseek = new VendorConfig();

    public String apiKey(String vendor) {
        VendorConfig config = config(vendor);
        return config == null ? "" : config.getApiKey();
    }

    public String baseUrl(String vendor) {
        VendorConfig config = config(vendor);
        return config == null ? "" : config.getBaseUrl();
    }

    /** 百炼业务空间 ID（用户未保存时兜底） */
    public String workspaceId(String vendor) {
        VendorConfig config = config(vendor);
        return config == null ? "" : config.getWorkspaceId();
    }

    /** 百炼地域代码（用户未保存时兜底，空则由调用方取 cn-beijing） */
    public String region(String vendor) {
        VendorConfig config = config(vendor);
        return config == null ? "" : config.getRegion();
    }

    private VendorConfig config(String vendor) {
        if ("dashscope".equalsIgnoreCase(vendor)) {
            return dashscope;
        }
        if ("deepseek".equalsIgnoreCase(vendor)) {
            return deepseek;
        }
        return null;
    }

    @Data
    public static class VendorConfig {
        private String apiKey = "";
        private String baseUrl = "";
        /** 百炼业务空间 ID，形如 llm-xxxx */
        private String workspaceId = "";
        /** 地域代码，默认 cn-beijing */
        private String region = "";
    }
}
