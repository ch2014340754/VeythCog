package com.vc.vcchat.llm.factory;

import com.vc.vcchat.llm.entity.LlmModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * 阿里百炼（DashScope）工厂：复用 spring-ai-alibaba starter 自动装配的 ChatModel。
 */
@Component
public class DashScopeVendorFactory implements LlmVendorFactory {

    private final ChatModel dashScopeChatModel;

    public DashScopeVendorFactory(@Qualifier("dashScopeChatModel") ChatModel dashScopeChatModel) {
        this.dashScopeChatModel = dashScopeChatModel;
    }

    @Override
    public boolean supports(String vendor) {
        return "dashscope".equalsIgnoreCase(vendor);
    }

    @Override
    public ChatModel create(LlmModel model, String apiKey, String baseUrl) {
        return dashScopeChatModel;
    }
}
