package com.vc.llm.metrics;

/**
 * 单次 LLM 调用的用量与结果快照。
 *
 * <p>放在 vc-llm 内、由 vc-admin 实现落库，避免 vc-llm 反向依赖管理域：
 * vc-llm 只负责「产出事实」，持久化与聚合是管理域的事。</p>
 */
public record LlmCallRecord(
        Long userId,
        String vendor,
        String modelCode,
        String conversationId,
        Integer promptTokens,
        Integer completionTokens,
        Integer totalTokens,
        /** provider：供应商返回的真实 usage；estimated：按字符估算 */
        String usageSource,
        int latencyMs,
        /** success / error */
        String status,
        String errorCode,
        String errorMessage,
        /** 用于估算 token 的原始文本，不落库 */
        String promptText,
        String completionText
) {
}
