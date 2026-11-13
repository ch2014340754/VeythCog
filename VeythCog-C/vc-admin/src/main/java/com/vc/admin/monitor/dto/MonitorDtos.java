package com.vc.admin.monitor.dto;

import java.util.List;

/**
 * 系统监控的对外返回结构（嵌套 records，避免为每个 DTO 单独建文件）。
 */
public final class MonitorDtos {

    private MonitorDtos() {
    }

    /** 概览卡片 */
    public record Overview(
            long calls,
            long errors,
            double errorRate,
            long p95Ms,
            long avgCostMs,
            long llmCalls,
            long promptTokens,
            long completionTokens,
            long totalTokens,
            long estimatedCalls,
            long activeUsers,
            long onlineSessions,
            long callsLastMinute
    ) {
    }

    /** 趋势点 */
    public record Point(
            String time,
            long calls,
            long errors,
            long avgCostMs,
            long p95Ms,
            long tokens
    ) {
    }

    /** 接口排行 */
    public record Endpoint(
            String route,
            String method,
            long calls,
            long errors,
            double errorRate,
            long avgCostMs,
            long p95Ms,
            long maxCostMs
    ) {
    }

    /** 错误明细 */
    public record ErrorItem(
            long id,
            String time,
            String route,
            String method,
            int bizCode,
            int status,
            Long userId,
            String rid,
            String message
    ) {
    }

    /** LLM 用量（按供应商 + 模型聚合） */
    public record LlmStat(
            String vendor,
            String modelCode,
            long calls,
            long errors,
            long promptTokens,
            long completionTokens,
            long totalTokens,
            long avgLatencyMs,
            long maxLatencyMs
    ) {
    }

    /** 会话条目 */
    public record SessionItem(
            String sid,
            Long userId,
            String username,
            String nickname,
            String ip,
            String userAgent,
            String loginAt,
            String lastActiveAt,
            boolean online,
            String status
    ) {
    }

    /** 服务资源占用 */
    public record Resource(
            String osName,
            String osVersion,
            int cpuCores,
            double systemCpuLoad,
            double processCpuLoad,
            double systemLoadAverage,
            long memoryTotal,
            long memoryUsed,
            long swapTotal,
            long swapUsed,
            long heapUsed,
            long heapMax,
            long heapCommitted,
            long nonHeapUsed,
            int liveThreads,
            long jvmUptimeMs,
            String jvmStartTime,
            String diskPath,
            long diskTotal,
            long diskUsable,
            long diskUsed,
            String sampledAt
    ) {
    }

    /** LLM 汇总 */
    public record LlmSummary(List<LlmStat> rows, long calls, long totalTokens, long errors) {
    }
}
