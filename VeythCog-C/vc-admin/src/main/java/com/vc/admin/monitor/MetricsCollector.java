package com.vc.admin.monitor;

import com.vc.admin.monitor.dto.ApiSampleEvent;
import com.vc.admin.monitor.dto.LlmCallEvent;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 监控指标采集器：内存队列 + 单线程批量落库 + 分钟桶聚合。
 *
 * <p>设计约束：请求线程只做入队（非阻塞），队列满直接丢弃并计数；
 * 真正的 INSERT 由 daemon 线程每 {@code monitor.flush-interval-ms} 批量执行，
 * 单机个人项目每天几百到几千请求，这个量级下写放大可忽略，也不引入额外中间件。</p>
 *
 * <p>双写：明细写 {@code sys_api_sample}（可钻取、可算精确 P95），
 * 同时按「分钟 + 方法 + 路由」聚合写 {@code sys_api_metric_minute}（长期趋势/排行）。</p>
 */
@Slf4j
@Component
public class MetricsCollector {

    private static final String INSERT_SAMPLE = """
            INSERT INTO sys_api_sample
                (ts, rid, user_id, ip, method, route, handler, status, biz_code, cost_ms, stream, error_msg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private static final String UPSERT_MINUTE = """
            INSERT INTO sys_api_metric_minute
                (bucket, method, route, calls, errors, sum_cost, max_cost,
                 lt50, lt100, lt300, lt1000, lt3000, ge3000)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (bucket, method, route) DO UPDATE SET
                calls    = sys_api_metric_minute.calls + EXCLUDED.calls,
                errors   = sys_api_metric_minute.errors + EXCLUDED.errors,
                sum_cost = sys_api_metric_minute.sum_cost + EXCLUDED.sum_cost,
                max_cost = GREATEST(sys_api_metric_minute.max_cost, EXCLUDED.max_cost),
                lt50     = sys_api_metric_minute.lt50 + EXCLUDED.lt50,
                lt100    = sys_api_metric_minute.lt100 + EXCLUDED.lt100,
                lt300    = sys_api_metric_minute.lt300 + EXCLUDED.lt300,
                lt1000   = sys_api_metric_minute.lt1000 + EXCLUDED.lt1000,
                lt3000   = sys_api_metric_minute.lt3000 + EXCLUDED.lt3000,
                ge3000   = sys_api_metric_minute.ge3000 + EXCLUDED.ge3000
            """;

    private static final String INSERT_LLM = """
            INSERT INTO llm_call_log
                (ts, user_id, vendor, model_code, conversation_id,
                 prompt_tokens, completion_tokens, total_tokens, usage_source,
                 latency_ms, status, error_code, error_msg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbc;
    private final MonitorProperties props;
    private final BlockingQueue<ApiSampleEvent> apiQueue;
    private final BlockingQueue<LlmCallEvent> llmQueue;
    private final AtomicLong dropped = new AtomicLong();
    private volatile boolean running = true;
    private Thread worker;

    public MetricsCollector(JdbcTemplate jdbc, MonitorProperties props) {
        this.jdbc = jdbc;
        this.props = props;
        this.apiQueue = new LinkedBlockingQueue<>(Math.max(1000, props.getQueueCapacity()));
        this.llmQueue = new LinkedBlockingQueue<>(Math.max(500, props.getQueueCapacity() / 2));
    }

    @PostConstruct
    void start() {
        if (!props.isEnabled()) {
            log.info("[monitor] 指标采集已关闭（monitor.enabled=false）");
            return;
        }
        worker = new Thread(this::loop, "monitor-metrics-flusher");
        worker.setDaemon(true);
        worker.start();
        log.info("[monitor] 指标采集启动：queue={} flush={}ms", props.getQueueCapacity(), props.getFlushIntervalMs());
    }

    @PreDestroy
    void stop() {
        running = false;
        if (worker != null) {
            worker.interrupt();
        }
        try {
            flush();
        } catch (Exception e) {
            log.warn("[monitor] 停机刷盘失败: {}", e.getMessage());
        }
    }

    public void recordApi(ApiSampleEvent event) {
        if (!props.isEnabled() || event == null) {
            return;
        }
        if (!apiQueue.offer(event)) {
            dropped.incrementAndGet();
        }
    }

    public void recordLlm(LlmCallEvent event) {
        if (!props.isEnabled() || event == null) {
            return;
        }
        if (!llmQueue.offer(event)) {
            dropped.incrementAndGet();
        }
    }

    /** 队列水位与丢弃数：接口异常时可从这里判断是不是采集侧限流 */
    public Map<String, Object> stats() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", props.isEnabled());
        map.put("apiQueue", apiQueue.size());
        map.put("llmQueue", llmQueue.size());
        map.put("dropped", dropped.get());
        return map;
    }

    private void loop() {
        while (running) {
            try {
                Thread.sleep(Math.max(200, props.getFlushIntervalMs()));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            try {
                flush();
            } catch (Exception e) {
                // 落库失败不重试也不丢数据以外的处理：下个周期继续，避免拖死线程
                log.warn("[monitor] 指标落库失败: {}", e.getMessage());
            }
        }
    }

    private void flush() {
        List<ApiSampleEvent> apiBatch = new ArrayList<>(props.getBatchSize());
        apiQueue.drainTo(apiBatch, props.getBatchSize());
        List<LlmCallEvent> llmBatch = new ArrayList<>(props.getBatchSize() / 3 + 1);
        llmQueue.drainTo(llmBatch, Math.max(50, props.getBatchSize() / 3));

        if (!apiBatch.isEmpty()) {
            insertSamples(apiBatch);
            upsertMinute(apiBatch);
        }
        if (!llmBatch.isEmpty()) {
            insertLlm(llmBatch);
        }
    }

    private void insertSamples(List<ApiSampleEvent> batch) {
        List<Object[]> rows = new ArrayList<>(batch.size());
        for (ApiSampleEvent e : batch) {
            rows.add(new Object[]{
                    Timestamp.from(e.ts()), e.rid(), e.userId(), e.ip(), e.method(), e.route(),
                    e.handler(), e.status(), e.bizCode(), e.costMs(), e.stream(), truncate(e.errorMessage())
            });
        }
        jdbc.batchUpdate(INSERT_SAMPLE, rows);
    }

    private void upsertMinute(List<ApiSampleEvent> batch) {
        Map<String, MinuteAcc> buckets = new HashMap<>();
        for (ApiSampleEvent e : batch) {
            Timestamp minute = Timestamp.from(e.ts().truncatedTo(ChronoUnit.MINUTES));
            String key = minute.getTime() + "|" + e.method() + "|" + e.route();
            MinuteAcc acc = buckets.computeIfAbsent(key,
                    k -> new MinuteAcc(minute, e.method(), e.route()));
            acc.calls++;
            if (e.bizCode() != 0 || e.status() >= 400) {
                acc.errors++;
            }
            acc.sumCost += e.costMs();
            acc.maxCost = Math.max(acc.maxCost, e.costMs());
            acc.hist[bucketIndex(e.costMs())]++;
        }
        List<Object[]> rows = new ArrayList<>(buckets.size());
        for (MinuteAcc a : buckets.values()) {
            rows.add(new Object[]{
                    a.bucket, a.method, a.route, a.calls, a.errors, a.sumCost, a.maxCost,
                    a.hist[0], a.hist[1], a.hist[2], a.hist[3], a.hist[4], a.hist[5]
            });
        }
        jdbc.batchUpdate(UPSERT_MINUTE, rows);
    }

    private void insertLlm(List<LlmCallEvent> batch) {
        List<Object[]> rows = new ArrayList<>(batch.size());
        for (LlmCallEvent e : batch) {
            rows.add(new Object[]{
                    Timestamp.from(e.ts()), e.userId(), e.vendor(), e.modelCode(), e.conversationId(),
                    e.promptTokens(), e.completionTokens(), e.totalTokens(), e.usageSource(),
                    e.latencyMs(), e.status(), e.errorCode(), truncate(e.errorMessage())
            });
        }
        jdbc.batchUpdate(INSERT_LLM, rows);
    }

    /** 耗时直方图桶：<50 / <100 / <300 / <1000 / <3000 / >=3000 */
    private static int bucketIndex(int costMs) {
        if (costMs < 50) return 0;
        if (costMs < 100) return 1;
        if (costMs < 300) return 2;
        if (costMs < 1000) return 3;
        if (costMs < 3000) return 4;
        return 5;
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    private static final class MinuteAcc {
        private final Timestamp bucket;
        private final String method;
        private final String route;
        private long calls;
        private long errors;
        private long sumCost;
        private int maxCost;
        private final long[] hist = new long[6];

        private MinuteAcc(Timestamp bucket, String method, String route) {
            this.bucket = bucket;
            this.method = method;
            this.route = route;
        }
    }
}
