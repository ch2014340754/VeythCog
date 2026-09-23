package com.vc.vcchat.llm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * LLM 供应商 AK / baseUrl 配置（读取 llm.vendors.*）。
 * 后期迁移 Nacos 时，改为从配置中心注入即可，业务不变。
 */
@Data
@Component
@ConfigurationProperties(prefix = "llm.vendors")
public class LlmVendorProps {

    private VendorConfig dashscope = new VendorConfig();
    private VendorConfig deepseek = new VendorConfig();

    public String apiKey(String vendor) {
        if ("dashscope".equalsIgnoreCase(vendor)) {
            return dashscope.getApiKey();
        }
        if ("deepseek".equalsIgnoreCase(vendor)) {
            return deepseek.getApiKey();
        }
        return "";
    }

    public String baseUrl(String vendor) {
        if ("dashscope".equalsIgnoreCase(vendor)) {
            return dashscope.getBaseUrl();
        }
        if ("deepseek".equalsIgnoreCase(vendor)) {
            return deepseek.getBaseUrl();
        }
        return "";
    }

    @Data
    public static class VendorConfig {
        private String apiKey = "";
        private String baseUrl = "";
    }
}
