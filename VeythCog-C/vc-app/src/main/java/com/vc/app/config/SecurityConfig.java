package com.vc.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.DispatcherTypeRequestMatcher;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.app.auth.jwt.JwtAuthFilter;
import com.vc.common.BaseResponse;
import com.vc.common.exception.ErrorCode;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

import java.util.List;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Spring Security 配置：无状态 + JWT 过滤器。
 * 放行 /auth/**、/health/**，其余接口需携带有效 JWT。
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, ObjectMapper objectMapper) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.objectMapper = objectMapper;
    }

    /**
     * CORS 放行前端来源：生产为 EdgeOne 上的 https://www.veythcog.top，另加本地开发源方便联调。
     * 前端已改用子域名 https://api.veythcog.top 访问后端，属跨域请求，必须放行 Origin。
     * 认证走 Authorization 请求头（非 Cookie），无需 allowCredentials。
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // 生产域名 + 本地开发任意端口（Vite dev 可能自动选 3001/3002）
        config.setAllowedOriginPatterns(List.of(
                "https://www.veythcog.top",
                "http://localhost:*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 异步分发（SseEmitter/SSE 流式）已在上层请求完成认证，放行避免二次鉴权
                        .requestMatchers(new DispatcherTypeRequestMatcher(DispatcherType.ASYNC)).permitAll()
                        .requestMatchers("/auth/**", "/health/**", "/error").permitAll()
                        // 壁纸缩略图由 <img> 直连（无法携带 Authorization），且 key 必须命中桶内对象才返回，
                        // 这里放行以便浏览器请求；其余 /nav 接口仍需 JWT。
                        .requestMatchers("/nav/wallpaper/thumb").permitAll()
                        // 接口文档（knife4j / springdoc）
                        .requestMatchers("/doc.html", "/v3/api-docs/**", "/swagger-ui.html",
                                "/swagger-ui/**", "/webjars/**", "/favicon.ico")
                        .permitAll()
                        // 系统管理仅 admin 角色
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((request, response, ex) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            objectMapper.writeValue(response.getWriter(),
                                    new BaseResponse<>(ErrorCode.NOT_LOGIN_ERROR.getCode(),
                                            null, ErrorCode.NOT_LOGIN_ERROR.getMessage()));
                        })
                        .accessDeniedHandler((request, response, ex) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            objectMapper.writeValue(response.getWriter(),
                                    new BaseResponse<>(ErrorCode.NO_AUTH_ERROR.getCode(),
                                            null, ErrorCode.NO_AUTH_ERROR.getMessage()));
                        }))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
