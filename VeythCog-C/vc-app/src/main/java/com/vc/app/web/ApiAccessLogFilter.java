package com.vc.app.web;

import com.vc.admin.monitor.MetricsCollector;
import com.vc.admin.monitor.dto.ApiSampleEvent;
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
import java.time.Instant;
import java.util.regex.Pattern;

/**
 * 接口访问日志 + 监控采样：统一记录"谁在什么时间调了哪个 Controller 方法、结果与耗时"。
 *
 * <p>放在装配层（vc-app）而非 vc-common：vc-common 明确"纯 POJO、不依赖 Spring Starter"，
 * 而本过滤器需要 servlet-api / spring-web；所有 Controller 又都集中在 vc-app，放这里即可覆盖全部接口。</p>
 *
 * <p>顺序：Spring Security 过滤器链在外层，本过滤器取最低优先级（内层），因此能读到已认证的 userId；
 * 安全上下文在安全链退出时会被清理，故必须在 {@code chain.doFilter} 之前取用户。</p>
 *
 * <p>日志格式（单行，便于 grep / 日志平台解析）：</p>
 * <pre>
 * [API] rid=3f2a user=1 ip=127.0.0.1 POST /api/chat/stream ChatController#stream status=200 biz=0 cost=42ms query=- body={"message":"..."}
 * </pre>
 * <p>密码 / token / apiKey 等字段在 body 与 query 中统一脱敏为 {@code ***}；
 * 搜索词不写进日志（P0 遗留缺口）。</p>
 *
 * <p>监控采样不含 body / query，只落「归一化路由 + 业务码 + 耗时」；
 * 落库由 vc-admin 的 MetricsCollector 异步完成，本过滤器只做非阻塞入队。</p>
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class ApiAccessLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiAccessLogFilter.class);

    /** 仅记录业务接口 */
    private static final String API_PREFIX = "/api";

    /** 健康检查不记录，避免噪音 */
    private static final String HEALTH_PATH = "/api/health";

    /** 监控自身接口不采样，否则轮询会把「调用量」自己撑起来 */
    private static final String MONITOR_PREFIX = "/api/admin/monitor";

    /** 单行日志中的请求体最大长度 */
    private static final int MAX_BODY_LENGTH = 1200;

    private static final int MAX_QUERY_LENGTH = 500;

    /** JSON 敏感字段脱敏 */
    private static final Pattern SENSITIVE_JSON = Pattern.compile(
            "(?i)\"(password|oldPassword|newPassword|token|apiKey|api-key|secret|accessKey)\"\\s*:\\s*\"[^\"]*\"");

    /** query 敏感参数名 */
    private static final Pattern SENSITIVE_PARAM = Pattern.compile(
            "(?i)(password|token|secret|apiKey|api-key|accessKey)");

    private final MetricsCollector metricsCollector;

    public ApiAccessLogFilter(MetricsCollector metricsCollector) {
        this.metricsCollector = metricsCollector;
    }

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
            int bizCode = intAttribute(wrapped, BizCodeAdvice.ATTR_BIZ_CODE, 0);
            String bizMessage = stringAttribute(wrapped, BizCodeAdvice.ATTR_BIZ_MESSAGE);
            String route = bestMatchingRoute(wrapped);
            boolean stream = isStream(wrapped, response, route);

            log.info("[API] rid={} user={} ip={} {} {} {} status={} biz={} cost={}ms query={} body={}",
                    rid,
                    user,
                    clientIp(request),
                    request.getMethod(),
                    request.getRequestURI(),
                    resolveHandler(wrapped),
                    response.getStatus(),
                    bizCode,
                    cost,
                    maskQuery(request.getQueryString()),
                    maskBody(wrapped));

            if (!wrapped.getRequestURI().startsWith(MONITOR_PREFIX)) {
                collect(new ApiSampleEvent(
                        Instant.now(),
                        rid,
                        parseUserId(user),
                        clientIp(request),
                        request.getMethod(),
                        route,
                        resolveHandler(wrapped),
                        response.getStatus(),
                        bizCode,
                        (int) Math.min(Integer.MAX_VALUE, cost),
                        stream,
                        bizCode != 0 ? truncate(bizMessage) : null));
            }
        }
    }

    private void collect(ApiSampleEvent event) {
        try {
            metricsCollector.recordApi(event);
        } catch (RuntimeException e) {
            // 监控是旁路，任何异常都不能影响业务请求
            log.debug("[API] 监控采样入队失败: {}", e.getMessage());
        }
    }

    private static boolean shouldLog(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri != null
                && uri.startsWith(API_PREFIX)
                && !HEALTH_PATH.equals(uri)
                && !"OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    /** 归一化路由（/knowledge/doc/{docId}），用于聚合；拿不到时退回真实 URI */
    private static String bestMatchingRoute(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern != null) {
            return String.valueOf(pattern);
        }
        return request.getRequestURI();
    }

    private static boolean isStream(HttpServletRequest request, HttpServletResponse response, String route) {
        String contentType = response.getContentType();
        if (contentType != null && contentType.contains("text/event-stream")) {
            return true;
        }
        return route != null && route.contains("/stream");
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

    private static Long parseUserId(String user) {
        if (user == null || "anon".equals(user)) {
            return null;
        }
        try {
            return Long.valueOf(user);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 命中的 Controller#method（由 DispatcherServlet 写入请求属性） */
    private static String resolveHandler(HttpServletRequest request) {
        Object handler = request.getAttribute(HandlerMapping.BEST_MATCHING_HANDLER_ATTRIBUTE);
        if (handler instanceof HandlerMethod handlerMethod) {
            return handlerMethod.getBeanType().getSimpleName() + "#" + handlerMethod.getMethod().getName();
        }
        return "-";
    }

    private static int intAttribute(HttpServletRequest request, String name, int defaultValue) {
        Object value = request.getAttribute(name);
        return value instanceof Integer i ? i : defaultValue;
    }

    private static String stringAttribute(HttpServletRequest request, String name) {
        Object value = request.getAttribute(name);
        return value == null ? null : String.valueOf(value);
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

    /** 请求体：脱敏 + 截断（下游未读取时为空，如 GET）；搜索词不入日志 */
    private static String maskBody(ContentCachingRequestWrapper request) {
        String uri = request.getRequestURI();
        if (uri != null && uri.contains("/nav/search")) {
            return "[redacted]";
        }
        byte[] buf = request.getContentAsByteArray();
        if (buf.length == 0) {
            return "-";
        }
        String body = new String(buf, StandardCharsets.UTF_8);
        body = SENSITIVE_JSON.matcher(body).replaceAll("\"$1\":\"***\"");
        body = body.replaceAll("\\s+", " ");
        return body.length() <= MAX_BODY_LENGTH ? body : body.substring(0, MAX_BODY_LENGTH) + "…";
    }

    /** query：敏感参数脱敏 + 截断；搜索关键词同样不落库 */
    private static String maskQuery(String query) {
        if (query == null || query.isBlank()) {
            return "-";
        }
        StringBuilder sb = new StringBuilder();
        for (String part : query.split("&")) {
            if (sb.length() > 0) sb.append('&');
            int eq = part.indexOf('=');
            String key = eq >= 0 ? part.substring(0, eq) : part;
            if ((eq >= 0 && SENSITIVE_PARAM.matcher(key).find()) || key.equalsIgnoreCase("q")) {
                sb.append(key).append("=***");
            } else {
                sb.append(part);
            }
        }
        String flat = sb.toString();
        return flat.length() <= MAX_QUERY_LENGTH ? flat : flat.substring(0, MAX_QUERY_LENGTH) + "…";
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 500 ? value : value.substring(0, 500);
    }
}
