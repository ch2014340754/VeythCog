package com.vc.admin.monitor;

import com.vc.admin.monitor.service.SessionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 监控数据保留任务：每天 03:30 清理过期明细/聚合/LLM 记录，并把长期不活跃会话置 expired。
 *
 * <p>保留期在 {@code monitor.retention.*} 配置：明细 30 天、分钟桶 90 天、LLM 90 天、会话 30 天。
 * 单机 PostgreSQL 上这些表都很小，清理用 DELETE 即可，不需要分区表。</p>
 */
@Slf4j
@Component
public class MonitorRetentionJob {

    private final JdbcTemplate jdbc;
    private final MonitorProperties props;
    private final SessionService sessionService;

    public MonitorRetentionJob(JdbcTemplate jdbc, MonitorProperties props, SessionService sessionService) {
        this.jdbc = jdbc;
        this.props = props;
        this.sessionService = sessionService;
    }

    @Scheduled(cron = "0 30 3 * * *")
    public void cleanup() {
        MonitorProperties.Retention r = props.getRetention();
        int samples = jdbc.update("DELETE FROM sys_api_sample WHERE ts < now() - make_interval(days => ?)", r.getSampleDays());
        int minutes = jdbc.update("DELETE FROM sys_api_metric_minute WHERE bucket < now() - make_interval(days => ?)", r.getMetricDays());
        int llm = jdbc.update("DELETE FROM llm_call_log WHERE ts < now() - make_interval(days => ?)", r.getLlmDays());
        int sessions = sessionService.expireIdle(r.getSessionDays());
        jdbc.update("DELETE FROM sys_user_session WHERE status <> 'active' AND last_active_at < now() - make_interval(days => ?)",
                r.getSessionDays());
        log.info("[monitor] 保留清理完成：samples={} minutes={} llm={} sessionsExpired={}", samples, minutes, llm, sessions);
    }
}
