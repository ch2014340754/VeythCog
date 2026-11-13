package com.vc.llm.factory;

import com.vc.llm.config.DashScopeEndpoint;
import com.vc.llm.entity.LlmModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 阿里百炼（DashScope）工厂：按传入的 AK / 业务空间动态构建 ChatModel。
 *
 * <p>对话统一走百炼的 OpenAI 兼容协议（{@code /compatible-mode/v1}），
 * 不再使用 {@code DashScopeChatModel} 的原生 {@code text-generation} 路径：
 * 后者只覆盖老模型，Qwen3.8-27B 等新模型会直接返回 {@code url error}，
 * 而兼容接口在标准域名和业务空间域名下均可用。</p>
 */
@Component
public class DashScopeVendorFactory implements LlmVendorFactory {

    @Override
    public boolean supports(String vendor) {
        return "dashscope".equalsIgnoreCase(vendor);
    }

    @Override
    public ChatModel create(LlmModel model, String apiKey, String baseUrl) {
        String compatibleBase = DashScopeEndpoint.compatibleModeBaseUrl(
                StringUtils.hasText(baseUrl) ? baseUrl : null);
        OpenAiApi api = OpenAiApi.builder()
                .apiKey(apiKey)
                .baseUrl(compatibleBase)
                // Spring AI 默认会拼 /v1/chat/completions，这里 base 已含 /compatible-mode/v1，
                // 必须显式覆盖，否则会变成 /compatible-mode/v1/v1/chat/completions → 404
                .completionsPath("/chat/completions")
                .build();
        return OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder()
                        .model(model.getModelCode())
                        .temperature(model.getTemperature() == null ? 0.7d : model.getTemperature().doubleValue())
                        .build())
                .build();
    }
}
