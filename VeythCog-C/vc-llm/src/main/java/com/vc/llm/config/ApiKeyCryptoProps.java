package com.vc.llm.config;

import lombok.Data;
import lombok.ToString;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 用户自持 API Key 的加密口令配置。
 *
 * <p>口令只从环境变量 {@code LLM_KEY_AES_SECRET} / 配置文件注入，禁止硬编码。
 * 未配置时应用仍可启动，仅「保存 Key / 解密已有密文」返回明确错误。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "llm.api-key-crypto")
public class ApiKeyCryptoProps {

    /** 加密口令（任意长度，内部 SHA-256 派生 32 字节 AES 密钥）。日志与 toString 中隐去。 */
    @ToString.Exclude
    private String secret = "";
}
