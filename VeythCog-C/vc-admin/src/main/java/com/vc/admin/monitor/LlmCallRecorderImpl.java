package com.vc.admin.monitor;

import com.vc.admin.monitor.dto.LlmCallEvent;
import com.vc.llm.metrics.LlmCallRecorder;
import com.vc.llm.metrics.LlmCallRecord;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * LLM 用量记录器实现：把 vc-llm 的事实快照转成监控事件并入队。
 *
 * <p>vc-llm 只依赖 {@link LlmCallRecorder} 接口，实现放在管理域，
 * 依赖方向保持 vc-app → vc-admin → vc-llm，不会循环。</p>
 */
@Component
public class LlmCallRecorderImpl implements LlmCallRecorder {

    private final MetricsCollector collector;

    public LlmCallRecorderImpl(MetricsCollector collector) {
        this.collector = collector;
    }

    @Override
    public void record(LlmCallRecord record) {
        collector.recordLlm(new LlmCallEvent(
                Instant.now(),
                record.userId(),
                record.vendor(),
                record.modelCode(),
                record.conversationId(),
                record.promptTokens(),
                record.completionTokens(),
                record.totalTokens(),
                record.usageSource(),
                record.latencyMs(),
                record.status(),
                record.errorCode(),
                record.errorMessage()
        ));
    }
}
