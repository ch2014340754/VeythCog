package com.vc.admin.monitor;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 监控配置：开关、异步队列与数据保留期。
 */
@Data
@Component
@ConfigurationProperties(prefix = "monitor")
public class MonitorProperties {

    /** 是否记录接口/LLM 指标（关掉后监控页只剩资源数据） */
    private boolean enabled = true;

    /** 异步队列容量，满则丢弃并计数，绝不阻塞请求线程 */
    private int queueCapacity = 10000;

    /** 批量落库间隔（毫秒） */
    private int flushIntervalMs = 2000;

    /** 单批最大条数 */
    private int batchSize = 300;

    /** 判定「在线」的活跃窗口（分钟） */
    private int onlineWindowMinutes = 5;

    private Retention retention = new Retention();

    @Data
    public static class Retention {
        /** 单请求明细保留天数 */
        private int sampleDays = 30;
        /** 分钟聚合保留天数 */
        private int metricDays = 90;
        /** LLM 调用记录保留天数 */
        private int llmDays = 90;
        /** 会话记录保留天数 */
        private int sessionDays = 30;
    }
}
