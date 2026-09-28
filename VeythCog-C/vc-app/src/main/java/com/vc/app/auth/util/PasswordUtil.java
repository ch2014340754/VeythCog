package com.vc.app.auth.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 密码工具类：BCrypt 单向加密，绝不存明文、不做可逆加密。
 */
public final class PasswordUtil {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    private PasswordUtil() {
    }

    /** 加密明文密码为 BCrypt 密文 */
    public static String encode(String rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    /** 校验明文与密文是否匹配 */
    public static boolean matches(String rawPassword, String encodedPassword) {
        return ENCODER.matches(rawPassword, encodedPassword);
    }
}
