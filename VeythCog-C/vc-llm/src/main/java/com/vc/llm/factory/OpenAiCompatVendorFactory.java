package com.vc.llm.factory;

import com.vc.llm.entity.LlmModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.stereotype.Component;

/**
 * OpenAI 兼容协议工厂（DeepSeek 等）：用 OpenAiChatModel 动态构建，绑定独立 AK 与 baseUrl。
 */
@Component
public class OpenAiCompatVendorFactory implements LlmVendorFactory {

    @Override
    public boolean supports(String vendor) {
        return "deepseek".equalsIgnoreCase(vendor);
    }

    @Override
    public ChatModel create(LlmModel model, String apiKey, String baseUrl) {
        String base = baseUrl == null ? "" : baseUrl.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        // Spring AI 默认 completionsPath 是 /v1/chat/completions；
        // 配置里的 baseUrl 若已带 /v1（DeepSeek 默认如此），必须去掉重复版本段
        String completionsPath = base.endsWith("/v1") ? "/chat/completions" : "/v1/chat/completions";
        OpenAiApi api = OpenAiApi.builder()
                .apiKey(apiKey)
                .baseUrl(base)
                .completionsPath(completionsPath)
                .build();
        return OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder()
                        .model(model.getModelCode())
                        .build())
                .build();
    }
}
