package com.vc.llm.metrics;

/**
 * LLM 调用记录器 SPI。
 *
 * <p>vc-llm 只定义接口；实现由管理域（vc-admin）提供，运行时通过 Spring 注入。
 * 未提供实现时（例如单独跑 LLM 模块测试）调用记录被静默忽略，不影响对话主流程。</p>
 */
public interface LlmCallRecorder {

    void record(LlmCallRecord record);
}
