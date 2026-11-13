package com.vc.llm.factory;

import com.alibaba.cloud.ai.dashscope.api.DashScopeApi;
import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatModel;
import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions;
import com.vc.llm.entity.LlmModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 阿里百炼（DashScope）工厂：按传入的 AK 动态构建 ChatModel。
 *
 * <p>不再复用 starter 自动装配的全局单例 —— 那个实例固定使用
 * {@code spring.ai.dashscope.api-key}，用户自持 Key 会完全不生效。
 * 这里每次按「用户解析出的 Key + 模型 code + temperature」新建实例，
 * 由路由层按 Key 指纹缓存，避免重复构建。</p>
 */
@Component
public class DashScopeVendorFactory implements LlmVendorFactory {

    @Override
    public boolean supports(String vendor) {
        return "dashscope".equalsIgnoreCase(vendor);
    }

    @Override
    public ChatModel create(LlmModel model, String apiKey, String baseUrl) {
        DashScopeApi.Builder apiBuilder = DashScopeApi.builder().apiKey(apiKey);
        if (StringUtils.hasText(baseUrl)) {
            apiBuilder.baseUrl(baseUrl.trim());
        }
        DashScopeApi api = apiBuilder.build();

        DashScopeChatOptions options = DashScopeChatOptions.builder()
                .withModel(model.getModelCode())
                .withTemperature(model.getTemperature() == null ? 0.7d : model.getTemperature().doubleValue())
                .build();

        return DashScopeChatModel.builder()
                .dashScopeApi(api)
                .defaultOptions(options)
                .build();
    }
}
