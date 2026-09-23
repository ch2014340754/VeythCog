package com.vc.vcchat.llm.factory;

import com.vc.vcchat.llm.entity.LlmModel;
import org.springframework.ai.chat.model.ChatModel;

/**
 * LLM 供应商工厂接口：按供应商创建/复用模型实例，收敛厂商 SDK 差异。
 */
public interface LlmVendorFactory {

    /** 该工厂是否支持某 vendor */
    boolean supports(String vendor);

    /** 创建模型实例（每个实例独立绑定 apiKey / baseUrl，避免串号） */
    ChatModel create(LlmModel model, String apiKey, String baseUrl);
}
