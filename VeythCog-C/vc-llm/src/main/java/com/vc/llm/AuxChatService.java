package com.vc.llm;

import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.AuxModelProps;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.factory.LlmVendorFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 辅助小模型调用入口（无记忆、无用户绑定校验）。
 *
 * <p>知识库摘要/标签生成与 RAG rerank 都走这里：模型由 {@code llm.aux-model.*} 固定配置，
 * 与用户当前对话所选模型无关，避免"用户换了对话模型导致元数据口径漂移"。</p>
 */
@Service
public class AuxChatService {

    /** 模型缓存：vendor:model → ChatClient（不含记忆顾问） */
    private final Map<String, ChatClient> cache = new ConcurrentHashMap<>();

    private final List<LlmVendorFactory> factories;
    private final LlmVendorProps vendorProps;
    private final AuxModelProps auxProps;

    public AuxChatService(List<LlmVendorFactory> factories,
                          LlmVendorProps vendorProps,
                          AuxModelProps auxProps) {
        this.factories = factories;
        this.vendorProps = vendorProps;
        this.auxProps = auxProps;
    }

    /**
     * 一次性补全：给定系统提示与用户内容，返回模型纯文本输出。
     * <p>失败时抛出 {@link BusinessException}，调用方按"增强能力失败不阻断主流程"处理。</p>
     */
    public String complete(String systemPrompt, String userPrompt) {
        String vendor = auxProps.getVendor();
        String modelCode = auxProps.getModelCode();
        try {
            ChatClient client = resolveClient(vendor, modelCode);
            return client.prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .options(optionsOf(vendor, modelCode))
                    .call()
                    .content();
        } catch (RuntimeException e) {
            String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "辅助模型调用失败：" + detail);
        }
    }

    /** 当前辅助模型标识，便于日志定位 */
    public String modelId() {
        return auxProps.getVendor() + "/" + auxProps.getModelCode();
    }

    private ChatClient resolveClient(String vendor, String modelCode) {
        String apiKey = vendorProps.apiKey(vendor);
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "辅助模型未配置密钥");
        }
        return cache.computeIfAbsent(vendor + ":" + modelCode, key -> {
            LlmVendorFactory factory = factories.stream()
                    .filter(f -> f.supports(vendor))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "不支持的厂商：" + vendor));
            LlmModel model = new LlmModel();
            model.setVendorCode(vendor);
            model.setModelCode(modelCode);
            model.setModelName(modelCode);
            model.setEnabled(true);
            ChatModel raw = factory.create(model, apiKey, vendorProps.baseUrl(vendor));
            return ChatClient.builder(raw).build();
        });
    }

    /**
     * 按厂商覆盖调用参数。
     * <p>DashScope 的 starter 只暴露一个 ChatModel（模型名由全局配置决定），
     * 必须按请求传 options 才能真正切到辅助小模型；OpenAI 兼容厂商则直接用业务模型编码。</p>
     */
    private ChatOptions optionsOf(String vendor, String modelCode) {
        double temperature = auxProps.getTemperature();
        if ("dashscope".equalsIgnoreCase(vendor)) {
            return DashScopeChatOptions.builder()
                    .model(modelCode)
                    .temperature(temperature)
                    .build();
        }
        return OpenAiChatOptions.builder()
                .model(modelCode)
                .temperature(temperature)
                .build();
    }
}
