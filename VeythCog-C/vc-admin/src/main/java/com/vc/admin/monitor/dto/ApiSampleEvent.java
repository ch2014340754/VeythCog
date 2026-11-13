package com.vc.admin.monitor.dto;

import java.time.Instant;

/**
 * 单次接口调用样本（由 vc-app 的 ApiAccessLogFilter 产出）。
 * 不包含请求体与 query：监控库只留「谁调了哪个接口、结果与耗时」。
 */
public record ApiSampleEvent(
        Instant ts,
        String rid,
        Long userId,
        String ip,
        String method,
        String route,
        String handler,
        int status,
        int bizCode,
        int costMs,
        boolean stream,
        String errorMessage
) {
}
