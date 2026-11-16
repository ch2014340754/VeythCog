package com.vc.music.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.music.config.MusicProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

/**
 * 播流短时签名服务。
 *
 * <p>{@code <audio src>} 由浏览器直连，带不上 {@code Authorization} 头，所以播流地址走 query token。
 * token 绑定「用户 + 曲目 + 过期时间」，签名用 HMAC-SHA256，因此既不能被猜出、
 * 也不能拿别人的 token 听别人的曲子。</p>
 *
 * <p>有效期默认 5 分钟：前端在下次列表静默刷新时换新 token；已建立的连接不受 token 过期影响。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicStreamTokenService {

    private static final String HMAC_SHA256 = "HmacSHA256";

    private final MusicProperties props;

    /** token 里携带的身份信息 */
    public record StreamIdentity(Long userId, Long trackId, long expiresAt) {
    }

    /**
     * 为指定用户 + 曲目签发短时 token。
     */
    public String issue(Long userId, Long trackId) {
        long expiresAt = Instant.now().getEpochSecond() + props.getStreamTokenMinutes() * 60L;
        String payload = userId + ":" + trackId + ":" + expiresAt;
        String body = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return body + "." + sign(body);
    }

    /**
     * 校验 token 并返回身份信息。
     *
     * @param token   前端 query 传入的签名
     * @param trackId 路径上的曲目 id，必须与 token 内绑定的一致
     * @throws BusinessException 40100（缺 token / 签名不符 / 已过期）
     */
    public StreamIdentity verify(String token, Long trackId) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "缺少播流签名，请刷新列表后重试");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名格式非法");
        }
        String body = parts[0];
        String signature = parts[1];
        if (!MessageDigest.isEqual(sign(body).getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名无效");
        }
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(body), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名格式非法");
        }
        String[] fields = payload.split(":");
        if (fields.length != 3) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名内容非法");
        }
        Long userId;
        Long boundTrackId;
        long expiresAt;
        try {
            userId = Long.valueOf(fields[0]);
            boundTrackId = Long.valueOf(fields[1]);
            expiresAt = Long.parseLong(fields[2]);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名内容非法");
        }
        if (trackId == null || !boundTrackId.equals(trackId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名与曲目不匹配");
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "播流签名已过期，请刷新列表后重试");
        }
        return new StreamIdentity(userId, boundTrackId, expiresAt);
    }

    private String sign(String body) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(props.getStreamSecret().getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            byte[] digest = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception e) {
            log.error("播流签名计算失败：{}", e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "播流签名计算失败");
        }
    }
}
