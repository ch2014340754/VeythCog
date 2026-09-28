package com.vc.app.auth.jwt;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

/**
 * JWT 配置（读取 jwt.*）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "jwt")
public class JwtProperties {

    /** 签名密钥（HS256，需足够长度；生产由环境变量 JWT_SECRET 覆盖） */
    private String secret;

    /** 过期时间（小时） */
    private long expireHours = 24;
}
