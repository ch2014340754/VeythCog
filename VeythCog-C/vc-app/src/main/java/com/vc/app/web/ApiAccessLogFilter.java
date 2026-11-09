package com.vc.app.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * 接口访问日志：统一记录"谁在什么时间调了哪个 Controller 方法、带了什么参数、结果与耗时"。
 *
 * <p>放在装配层（vc-app）而非 vc-common：vc-common 的 pom 明确声明"纯 POJO、不依赖任何 Spring Starter"，
 * 而本过滤器需要 servlet-api / spring-web；所有 Controller 又都集中在 vc-app，放这里即可覆盖全部模块的接口。</p>
 *
 * <p>顺序：Spring Security 过滤器链 order=-100 在外层，本过滤器取最低优先级（内层），
 * 因此能读到已认证的 userId；上下文在安全链退出时会被清理，故必须在 {@code chain.doFilter} 之前取用户。</p>
 *
 * <p>日志格式（单行，便于 grep / 日志平台解析）：</p>
 * <pre>
 * [API] rid=3f2a user=1 ip=127.0.0.1 POST /api/chat/stream ChatController#stream status=200 cost=42ms query=- body={"message":"..."}
 * </pre>
 * <p>密码 / token / apiKey 等字段在 body 与 query 中统一脱敏为 {@code ***}。</p>
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class ApiAccessLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiAccessLogFilter.class);

    /** 仅记录业务接口 */
    private static final String API_PREFIX = "/api";

    /** 健康检查不记录，避免噪音 */
    private static final String HEALTH_PATH = "/api/health";

    /** 单行日志中的请求体最大长度 */
    private static final int MAX_BODY_LENGTH = 1200;

    private static final int MAX_QUERY_LENGTH = 500;

    /** JSON 敏感字段脱敏 */
    private static final Pattern SENSITIVE_JSON = Pattern.compile(
            "(?i)\"(password|oldPassword|newPassword|token|apiKey|api-key|secret|accessKey)\"\\s*:\\s*\"[^\"]*\"");

    /** query 敏感参数名 */
    private static final Pattern SENSITIVE_PARAM = Pattern.compile(
            "(?i)(password|token|secret|apiKey|api-key|accessKey)");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!shouldLog(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        // 必须在安全链清理 SecurityContext 之前取用户
        String user = resolveUser();
        String rid = Long.toHexString(System.nanoTime() & 0xFFFFFFFFL);
        long start = System.currentTimeMillis();
        ContentCachingRequestWrapper wrapped = new ContentCachingRequestWrapper(request);

        try {
            filterChain.doFilter(wrapped, response);
        } finally {
            long cost = System.currentTimeMillis() - start;
            log.info("[API] rid={} user={} ip={} {} {} {} status={} cost={}ms query={} body={}",
                    rid,
                    user,
                    clientIp(request),
                    request.getMethod(),
                    request.getRequestURI(),
                    resolveHandler(wrapped),
                    response.getStatus(),
                    cost,
                    maskQuery(request.getQueryString()),
                    maskBody(wrapped));
        }
    }

    private static boolean shouldLog(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null
                && uri.startsWith(API_PREFIX)
                && !HEALTH_PATH.equals(uri)
                && !"OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    /** 登录用户 id（JWT 过滤器把 userId 放进了 principal）；未登录记 anon */
    private static String resolveUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return "anon";
        }
        Object principal = auth.getPrincipal();
        if (principal == null) {
            return "anon";
        }
        String value = String.valueOf(principal);
        // Spring Security 未认证时 principal 是字符串 "anonymousUser"
        return "anonymousUser".equals(value) ? "anon" : value;
    }

    /** 命中的 Controller#method（由 DispatcherServlet 写入请求属性） */
    private static String resolveHandler(HttpServletRequest request) {
        Object handler = request.getAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE);
        if (handler instanceof HandlerMethod handlerMethod) {
            return handlerMethod.getBeanType().getSimpleName() + "#" + handlerMethod.getMethod().getName();
        }
        return "-";
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String remote = request.getRemoteAddr();
        // 本机访问统一成 IPv4，便于日志检索
        return "0:0:0:0:0:0:0:1".equals(remote) ? "127.0.0.1" : remote;
    }

    /** 请求体：脱敏 + 截断（下游未读取时为空，如 GET） */
    private static String maskBody(ContentCachingRequestWrapper request) {
        byte[] buf = request.getContentAsByteArray();
        if (buf.length == 0) {
            return "-";
        }
        String body = new String(buf, StandardCharsets.UTF_8);
        body = SENSITIVE_JSON.matcher(body).replaceAll("\"$1\":\"***\"");
        body = body.replaceAll("\\s+", " ");
        return body.length() <= MAX_BODY_LENGTH ? body : body.substring(0, MAX_BODY_LENGTH) + "…";
    }

    /** query：敏感参数脱敏 + 截断 */
    private static String maskQuery(String query) {
        if (query == null || query.isBlank()) {
            return "-";
        }
        StringBuilder sb = new StringBuilder();
        for (String part : query.split("&")) {
            if (sb.length() > 0) sb.append('&');
            int eq = part.indexOf('=');
            String key = eq >= 0 ? part.substring(0, eq) : part;
            if (eq >= 0 && SENSITIVE_PARAM.matcher(key).find()) {
                sb.append(key).append("=***");
            } else {
                sb.append(part);
            }
        }
        String flat = sb.toString();
        return flat.length() <= MAX_QUERY_LENGTH ? flat : flat.substring(0, MAX_QUERY_LENGTH) + "…";
    }
}
