package com.vc.llm.crypto;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.ApiKeyCryptoProps;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 用户 API Key 的加解密与脱敏。
 *
 * <ul>
 *   <li>算法：AES-256-GCM（12 字节随机 IV，128 位认证标签）；</li>
 *   <li>存储格式：{@code base64(iv) + ":" + base64(ciphertext)}；</li>
 *   <li>密钥：环境变量 {@code LLM_KEY_AES_SECRET} 经 SHA-256 派生 32 字节，禁止硬编码；</li>
 *   <li>脱敏：前 4 后 4，短 Key（长度 &lt; 8）只留首尾各 1 位。</li>
 * </ul>
 *
 * <p>任何日志、异常信息都不允许输出明文 Key 或完整密文。</p>
 */
@Service
public class ApiKeyCryptoService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;
    private static final String SEPARATOR = ":";
    private static final String MASK = "****";

    private final SecretKeySpec aesKey;
    private final SecureRandom random = new SecureRandom();

    public ApiKeyCryptoService(ApiKeyCryptoProps props) {
        String secret = props.getSecret();
        this.aesKey = (secret == null || secret.isBlank()) ? null : deriveKey(secret.trim());
    }

    /** 是否已配置加密口令（未配置不影响应用启动与既有兜底链路） */
    public boolean isConfigured() {
        return aesKey != null;
    }

    /** 加密明文 Key；空白入参不允许（调用方应先判空） */
    public String encrypt(String plainKey) {
        requireConfigured();
        String plain = plainKey == null ? "" : plainKey.trim();
        if (plain.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "API Key 不能为空");
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            Base64.Encoder encoder = Base64.getEncoder();
            return encoder.encodeToString(iv) + SEPARATOR + encoder.encodeToString(cipherText);
        } catch (GeneralSecurityException e) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "API Key 加密失败");
        }
    }

    /** 解密；口令缺失或密文损坏时抛出明确业务错误，不落上游调用 */
    public String decrypt(String cipherText) {
        if (cipherText == null || cipherText.isBlank()) {
            return null;
        }
        requireConfigured();
        try {
            int idx = cipherText.indexOf(SEPARATOR);
            if (idx <= 0 || idx >= cipherText.length() - 1) {
                throw new GeneralSecurityException("bad format");
            }
            byte[] iv = Base64.getDecoder().decode(cipherText.substring(0, idx));
            byte[] ct = Base64.getDecoder().decode(cipherText.substring(idx + 1));
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "密钥解密失败，请重新配置 API Key");
        }
    }

    /** 脱敏展示：明文为空返回 null */
    public String mask(String plainKey) {
        if (plainKey == null || plainKey.isBlank()) {
            return null;
        }
        String v = plainKey.trim();
        if (v.length() >= 8) {
            return v.substring(0, 4) + MASK + v.substring(v.length() - 4);
        }
        if (v.length() <= 2) {
            return MASK;
        }
        return v.charAt(0) + "***" + v.charAt(v.length() - 1);
    }

    /** 密文脱敏：解密失败时只返回 ****，避免把密文暴露到前端 */
    public String maskCipherOrMasked(String cipherText) {
        if (cipherText == null || cipherText.isBlank()) {
            return null;
        }
        try {
            return mask(decrypt(cipherText));
        } catch (BusinessException e) {
            return MASK;
        }
    }

    /** Key 指纹：SHA-256 前 8 位十六进制，仅用于缓存隔离，不可反推 */
    public String fingerprint(String plainKey) {
        String v = plainKey == null ? "" : plainKey.trim();
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(v.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 4; i++) {
                sb.append(String.format("%02x", digest[i]));
            }
            return sb.toString();
        } catch (GeneralSecurityException e) {
            return Integer.toHexString(v.hashCode());
        }
    }

    private void requireConfigured() {
        if (aesKey == null) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR,
                    "服务端未配置密钥加密口令（LLM_KEY_AES_SECRET）");
        }
    }

    private static SecretKeySpec deriveKey(String secret) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] key = md.digest(secret.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(key, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("无法初始化 API Key 加密组件", e);
        }
    }
}
