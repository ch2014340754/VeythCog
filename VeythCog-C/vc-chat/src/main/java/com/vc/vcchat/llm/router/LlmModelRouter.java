package com.vc.vcchat.llm.router;

import com.vc.vcchat.llm.config.LlmVendorProps;
import com.vc.vcchat.llm.entity.LlmModel;
import com.vc.vcchat.llm.entity.UserLlmBinding;
import com.vc.vcchat.llm.factory.LlmVendorFactory;
import com.vc.vcchat.llm.repository.LlmModelRepository;
import com.vc.vcchat.llm.repository.UserLlmBindingRepository;
import com.vc.vccode.exception.BusinessException;
import com.vc.vccode.exception.ErrorCode;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 模型路由：校验用户绑定 → 查模型配置 → 缓存实例 → 调用模型。
 */
@Service
public class LlmModelRouter {

    private final UserLlmBindingRepository bindingRepository;
    private final LlmModelRepository modelRepository;
    private final List<LlmVendorFactory> factories;
    private final LlmVendorProps vendorProps;
    private final Map<String, ChatModel> cache = new ConcurrentHashMap<>();

    public LlmModelRouter(UserLlmBindingRepository bindingRepository,
                          LlmModelRepository modelRepository,
                          List<LlmVendorFactory> factories,
                          LlmVendorProps vendorProps) {
        this.bindingRepository = bindingRepository;
        this.modelRepository = modelRepository;
        this.factories = factories;
        this.vendorProps = vendorProps;
    }

    public String chat(Long userId, String vendor, String modelCode, String message) {
        UserLlmBinding binding = bindingRepository
                .findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用"));
        if (!Boolean.TRUE.equals(binding.getEnabled())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用");
        }
        LlmModel model = modelRepository.findByVendorCodeAndModelCode(vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用"));
        if (!Boolean.TRUE.equals(model.getEnabled())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用");
        }

        String apiKey = vendorProps.apiKey(vendor);
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "该模型未配置密钥");
        }

        ChatModel chatModel = cache.computeIfAbsent(vendor + ":" + modelCode, k -> {
            LlmVendorFactory factory = factories.stream()
                    .filter(f -> f.supports(vendor))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "不支持的厂商"));
            return factory.create(model, apiKey, vendorProps.baseUrl(vendor));
        });

        try {
            AssistantMessage output = chatModel.call(new Prompt(message)).getResult().getOutput();
            return output.getText();
        } catch (RuntimeException e) {
            String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "模型调用失败：" + detail);
        }
    }
}
