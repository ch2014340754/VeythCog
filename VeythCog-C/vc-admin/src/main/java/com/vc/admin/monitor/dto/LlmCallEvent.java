package com.vc.admin.monitor.dto;

import java.time.Instant;

/**
 * 单次 LLM 调用记录（由 vc-llm 的 LlmModelRouter 产出）。
 */
public record LlmCallEvent(
        Instant ts,
        Long userId,
        String vendor,
        String modelCode,
        String conversationId,
        Integer promptTokens,
        Integer completionTokens,
        Integer totalTokens,
        String usageSource,
        int latencyMs,
        String status,
        String errorCode,
        String errorMessage
) {
}
