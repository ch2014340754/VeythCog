package com.vc.app.auth.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.vc.admin.monitor.service.SessionService;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT 鉴权过滤器：解析 Authorization: Bearer <token>，把 userId 塞入 SecurityContext。
 * 无 token / token 无效 / 会话已被踢时都不设置认证，由 Security 统一返回 401。
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final SessionService sessionService;

    public JwtAuthFilter(JwtUtil jwtUtil, SessionService sessionService) {
        this.jwtUtil = jwtUtil;
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                String token = auth.substring(7);
                Long userId = jwtUtil.parseUserId(token);
                String sid = jwtUtil.parseSessionId(token);
                // 会话被踢 / 登出 / 过期后，旧 token 立即失效（这是「强制下线」的落地点）
                if (!sessionService.isActive(sid)) {
                    filterChain.doFilter(request, response);
                    return;
                }
                sessionService.touch(sid);
                java.util.Set<String> roles = jwtUtil.parseRoles(token);
                java.util.List<org.springframework.security.core.authority.SimpleGrantedAuthority> authorities =
                        roles.stream()
                                .map(r -> new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_" + r.toUpperCase()))
                                .toList();
                var authentication = new UsernamePasswordAuthenticationToken(
                        userId,
                        null,
                        authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception ignored) {
                // token 无效 / 旧 token 无 sid：不设置认证，后续返回 401
            }
        }
        filterChain.doFilter(request, response);
    }
}
