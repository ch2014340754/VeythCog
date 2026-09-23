package com.vc.vcchat.llm.factory;

import com.vc.vcchat.llm.entity.LlmModel;
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
        OpenAiApi api = OpenAiApi.builder()
                .apiKey(apiKey)
                .baseUrl(baseUrl)
                .build();
        return OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder()
                        .model(model.getModelCode())
                        .build())
                .build();
    }
}
