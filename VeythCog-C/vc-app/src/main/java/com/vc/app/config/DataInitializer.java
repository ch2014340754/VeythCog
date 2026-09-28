package com.vc.app.config;

import com.vc.app.auth.entity.User;
import com.vc.app.auth.repository.UserRepository;
import com.vc.app.auth.util.PasswordUtil;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.repository.LlmModelRepository;
import com.vc.llm.repository.UserLlmBindingRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * 启动种子数据（幂等）：表空时才插入。
 * 模型目录 / 初始 admin 用户 / admin 默认绑定。
 * 供应商为后端枚举（com.vc.llm.enums.LlmVendor），不落库。
 * 账号：admin / admin123
 */
@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    private final LlmModelRepository modelRepository;
    private final UserRepository userRepository;
    private final UserLlmBindingRepository bindingRepository;

    public DataInitializer(LlmModelRepository modelRepository,
                           UserRepository userRepository,
                           UserLlmBindingRepository bindingRepository) {
        this.modelRepository = modelRepository;
        this.userRepository = userRepository;
        this.bindingRepository = bindingRepository;
    }

    @Override
    public void run(String... args) {
        seedModels();
        seedAdmin();
    }

    private void seedModels() {
        if (modelRepository.count() > 0) {
            return;
        }
        LlmModel qwen = new LlmModel();
        qwen.setVendorCode("dashscope");
        qwen.setModelCode("qwen-plus");
        qwen.setModelName("通义千问 Plus");
        qwen.setMaxContextTokens(32768);
        qwen.setTemperature(new BigDecimal("0.70"));
        qwen.setEnabled(true);

        LlmModel ds = new LlmModel();
        ds.setVendorCode("deepseek");
        ds.setModelCode("deepseek-chat");
        ds.setModelName("DeepSeek Chat");
        ds.setMaxContextTokens(65536);
        ds.setTemperature(new BigDecimal("0.70"));
        ds.setEnabled(true);

        modelRepository.saveAll(List.of(qwen, ds));
        log.info("[seed] 已初始化模型目录：qwen-plus / deepseek-chat");
    }

    private void seedAdmin() {
        if (userRepository.count() > 0) {
            return;
        }
        User admin = new User();
        admin.setUsername("admin");
        admin.setPassword(PasswordUtil.encode("admin123"));
        admin.setNickname("管理员");
        admin.setEmail("admin@veythcog.local");
        admin = userRepository.save(admin);

        // 绑定 dashscope/qwen-plus 为默认模型
        if (bindingRepository.findByUserId(admin.getId()).isEmpty()) {
            UserLlmBinding binding = new UserLlmBinding();
            binding.setUserId(admin.getId());
            binding.setVendorCode("dashscope");
            binding.setModelCode("qwen-plus");
            binding.setIsDefault(true);
            binding.setEnabled(true);
            bindingRepository.save(binding);
        }
        log.info("[seed] 已初始化管理员：admin / admin123，默认绑定 qwen-plus");
    }
}
