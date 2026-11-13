package com.vc.admin.monitor.service;

import com.vc.admin.monitor.MonitorProperties;
import com.vc.admin.monitor.dto.MonitorDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 监控查询服务（中台）：把明细/分钟桶/LLM 记录/会话表聚合成页面需要的视图。
 *
 * <p>口径说明：
 * <ul>
 *   <li>业务错误看 {@code biz_code <> 0}：后端统一返回 HTTP 200 + 业务码，只看 status 会永远得到 0 错误；</li>
 *   <li>P95 用 {@code percentile_cont}，24h/7d 直接扫明细；接口排行同理；</li>
 *   <li>时间分桶按 Asia/Shanghai 本地时区，避免服务器 UTC 把「今日」切错；</li>
 *   <li>SSE 接口（route 含 /stream）单独标 stream 字段，P95 会把长连接算进去，页面上单列提示。</li>
 * </ul>
 */
@Service
public class MonitorQueryService {

    private static final String TZ = "Asia/Shanghai";

    private final JdbcTemplate jdbc;
    private final MonitorProperties props;

    public MonitorQueryService(JdbcTemplate jdbc, MonitorProperties props) {
        this.jdbc = jdbc;
        this.props = props;
    }

    public MonitorDtos.Overview overview(int hours) {
        int h = clampHours(hours);
        String sql = """
                SELECT count(*) AS calls,
                       count(*) FILTER (WHERE biz_code <> 0 OR status >= 400) AS errors,
                       COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY cost_ms), 0) AS p95,
                       COALESCE(avg(cost_ms), 0) AS avg_cost,
                       count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS users,
                       count(*) FILTER (WHERE ts >= now() - interval '1 minute') AS last_minute
                  FROM sys_api_sample
                 WHERE ts >= now() - make_interval(hours => ?)
                """;
        long[] api = jdbc.query(sql, rs -> {
            if (!rs.next()) {
                return new long[]{0, 0, 0, 0, 0, 0};
            }
            return new long[]{
                    rs.getLong("calls"), rs.getLong("errors"),
                    Math.round(rs.getDouble("p95")), Math.round(rs.getDouble("avg_cost")),
                    rs.getLong("users"), rs.getLong("last_minute")
            };
        }, h);

        long[] llm = jdbc.query("""
                SELECT count(*) AS calls,
                       COALESCE(sum(prompt_tokens), 0) AS prompt,
                       COALESCE(sum(completion_tokens), 0) AS completion,
                       COALESCE(sum(total_tokens), 0) AS total,
                       count(*) FILTER (WHERE usage_source = 'estimated') AS estimated
                  FROM llm_call_log
                 WHERE ts >= now() - make_interval(hours => ?)
                """, rs -> {
            if (!rs.next()) {
                return new long[]{0, 0, 0, 0, 0};
            }
            return new long[]{rs.getLong("calls"), rs.getLong("prompt"), rs.getLong("completion"),
                    rs.getLong("total"), rs.getLong("estimated")};
        }, h);

        long online = countOnline();

        double errorRate = api[0] == 0 ? 0 : (double) api[1] / api[0];
        return new MonitorDtos.Overview(api[0], api[1], round4(errorRate), api[2], api[3],
                llm[0], llm[1], llm[2], llm[3], llm[4], api[4], online, api[5]);
    }

    /** 趋势：24h 内按小时、超过 24h 按天；调用/错误/耗时/token 一次返回，前端只画一张图 */
    public List<MonitorDtos.Point> timeseries(int hours) {
        int h = clampHours(hours);
        String format = h <= 24 ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";
        String sql = """
                SELECT to_char(ts AT TIME ZONE '%s', '%s') AS bucket,
                       count(*) AS calls,
                       count(*) FILTER (WHERE biz_code <> 0 OR status >= 400) AS errors,
                       COALESCE(avg(cost_ms), 0) AS avg_cost,
                       COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY cost_ms), 0) AS p95
                  FROM sys_api_sample
                 WHERE ts >= now() - make_interval(hours => ?)
                 GROUP BY 1
                 ORDER BY 1
                """.formatted(TZ, format);

        Map<String, long[]> api = new LinkedHashMap<>();
        jdbc.query(sql, (RowCallbackHandler) rs -> api.put(rs.getString("bucket"), new long[]{
                rs.getLong("calls"), rs.getLong("errors"),
                Math.round(rs.getDouble("avg_cost")), Math.round(rs.getDouble("p95"))
        }), h);

        String tokenSql = """
                SELECT to_char(ts AT TIME ZONE '%s', '%s') AS bucket,
                       COALESCE(sum(total_tokens), 0) AS tokens
                  FROM llm_call_log
                 WHERE ts >= now() - make_interval(hours => ?)
                 GROUP BY 1
                """.formatted(TZ, format);
        Map<String, Long> tokens = new LinkedHashMap<>();
        jdbc.query(tokenSql, (RowCallbackHandler) rs -> tokens.put(rs.getString("bucket"), rs.getLong("tokens")), h);

        List<MonitorDtos.Point> points = new ArrayList<>(api.size());
        for (Map.Entry<String, long[]> e : api.entrySet()) {
            long[] v = e.getValue();
            points.add(new MonitorDtos.Point(e.getKey(), v[0], v[1], v[2], v[3],
                    tokens.getOrDefault(e.getKey(), 0L)));
        }
        return points;
    }

    public List<MonitorDtos.Endpoint> endpoints(int hours, String sort, int limit) {
        int h = clampHours(hours);
        String orderBy = switch (sort == null ? "calls" : sort.toLowerCase(Locale.ROOT)) {
            case "errors" -> "errors DESC, calls DESC";
            case "p95" -> "p95 DESC, calls DESC";
            case "cost" -> "avg_cost DESC, calls DESC";
            default -> "calls DESC";
        };
        String sql = """
                SELECT route, method,
                       count(*) AS calls,
                       count(*) FILTER (WHERE biz_code <> 0 OR status >= 400) AS errors,
                       COALESCE(avg(cost_ms), 0) AS avg_cost,
                       COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY cost_ms), 0) AS p95,
                       COALESCE(max(cost_ms), 0) AS max_cost
                  FROM sys_api_sample
                 WHERE ts >= now() - make_interval(hours => ?)
                 GROUP BY route, method
                 ORDER BY %s
                 LIMIT ?
                """.formatted(orderBy);
        return jdbc.query(sql, (rs, i) -> {
            long calls = rs.getLong("calls");
            long errors = rs.getLong("errors");
            return new MonitorDtos.Endpoint(
                    rs.getString("route"), rs.getString("method"), calls, errors,
                    round4(calls == 0 ? 0 : (double) errors / calls),
                    Math.round(rs.getDouble("avg_cost")), Math.round(rs.getDouble("p95")),
                    rs.getLong("max_cost"));
        }, h, Math.max(1, Math.min(limit, 100)));
    }

    public List<MonitorDtos.ErrorItem> errors(int hours, int limit) {
        int h = clampHours(hours);
        String sql = """
                SELECT id,
                       to_char(ts AT TIME ZONE '%s', 'YYYY-MM-DD HH24:MI:SS') AS time_text,
                       route, method, biz_code, status, user_id, rid, error_msg
                  FROM sys_api_sample
                 WHERE ts >= now() - make_interval(hours => ?)
                   AND (biz_code <> 0 OR status >= 400)
                 ORDER BY ts DESC
                 LIMIT ?
                """.formatted(TZ);
        return jdbc.query(sql, (rs, i) -> new MonitorDtos.ErrorItem(
                rs.getLong("id"), rs.getString("time_text"), rs.getString("route"), rs.getString("method"),
                rs.getInt("biz_code"), rs.getInt("status"),
                (Long) rs.getObject("user_id"), rs.getString("rid"),
                defaultIfNull(rs.getString("error_msg"))), h, Math.max(1, Math.min(limit, 200)));
    }

    public MonitorDtos.LlmSummary llm(int hours) {
        int h = clampHours(hours);
        String sql = """
                SELECT vendor, model_code,
                       count(*) AS calls,
                       count(*) FILTER (WHERE status <> 'success') AS errors,
                       COALESCE(sum(prompt_tokens), 0) AS prompt,
                       COALESCE(sum(completion_tokens), 0) AS completion,
                       COALESCE(sum(total_tokens), 0) AS total,
                       COALESCE(avg(latency_ms), 0) AS avg_latency,
                       COALESCE(max(latency_ms), 0) AS max_latency
                  FROM llm_call_log
                 WHERE ts >= now() - make_interval(hours => ?)
                 GROUP BY vendor, model_code
                 ORDER BY calls DESC
                """;
        List<MonitorDtos.LlmStat> rows = jdbc.query(sql, (rs, i) -> new MonitorDtos.LlmStat(
                rs.getString("vendor"), rs.getString("model_code"), rs.getLong("calls"), rs.getLong("errors"),
                rs.getLong("prompt"), rs.getLong("completion"), rs.getLong("total"),
                Math.round(rs.getDouble("avg_latency")), rs.getLong("max_latency")), h);
        long calls = rows.stream().mapToLong(MonitorDtos.LlmStat::calls).sum();
        long tokens = rows.stream().mapToLong(MonitorDtos.LlmStat::totalTokens).sum();
        long errors = rows.stream().mapToLong(MonitorDtos.LlmStat::errors).sum();
        return new MonitorDtos.LlmSummary(rows, calls, tokens, errors);
    }

    public List<MonitorDtos.SessionItem> sessions() {
        String sql = """
                SELECT s.sid, s.user_id, s.username, u.nickname, s.ip, s.user_agent,
                       to_char(s.login_at AT TIME ZONE '%s', 'YYYY-MM-DD HH24:MI:SS') AS login_text,
                       to_char(s.last_active_at AT TIME ZONE '%s', 'YYYY-MM-DD HH24:MI:SS') AS active_text,
                       s.status,
                       (s.last_active_at >= now() - make_interval(mins => ?)) AS online
                  FROM sys_user_session s
                  LEFT JOIN app_user u ON u.id = s.user_id
                 WHERE s.status = 'active'
                   AND s.last_active_at >= now() - interval '7 days'
                 ORDER BY s.last_active_at DESC
                 LIMIT 100
                """.formatted(TZ, TZ);
        return jdbc.query(sql, (rs, i) -> new MonitorDtos.SessionItem(
                rs.getString("sid"), (Long) rs.getObject("user_id"), rs.getString("username"),
                rs.getString("nickname"), rs.getString("ip"), rs.getString("user_agent"),
                rs.getString("login_text"), rs.getString("active_text"),
                rs.getBoolean("online"), rs.getString("status")), props.getOnlineWindowMinutes());
    }

    public long countOnline() {
        Long count = jdbc.queryForObject("""
                SELECT count(*) FROM sys_user_session
                 WHERE status = 'active' AND last_active_at >= now() - make_interval(mins => ?)
                """, Long.class, props.getOnlineWindowMinutes());
        return count == null ? 0 : count;
    }

    private static int clampHours(int hours) {
        return Math.max(1, Math.min(hours, 24 * 30));
    }

    private static double round4(double value) {
        return Math.round(value * 10000d) / 10000d;
    }

    private static String defaultIfNull(String value) {
        return value == null ? "" : value;
    }
}
