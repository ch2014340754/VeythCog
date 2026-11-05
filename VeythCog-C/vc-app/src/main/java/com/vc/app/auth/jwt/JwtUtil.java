package com.vc.app.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 工具：签发 / 解析 / 校验（HS256）。
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expireMillis;

    public JwtUtil(JwtProperties props) {
        this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
        this.expireMillis = props.getExpireHours() * 3_600_000L;
    }

    /** 签发 token，subject 为 userId，附带 username + roles 声明 */
    public String generate(Long userId, String username, java.util.Set<String> roles) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("roles", roles == null ? java.util.List.of() : roles)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expireMillis))
                .signWith(key)
                .compact();
    }

    /** 解析 token 返回 userId；无效/过期抛异常 */
    public Long parseUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return Long.valueOf(claims.getSubject());
    }

    /** 解析 token 返回角色 code 列表 */
    @SuppressWarnings("unchecked")
    public java.util.Set<String> parseRoles(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Object roles = claims.get("roles");
        if (roles instanceof java.util.List) {
            return new java.util.HashSet<>((java.util.List<String>) roles);
        }
        return java.util.Set.of();
    }
}
