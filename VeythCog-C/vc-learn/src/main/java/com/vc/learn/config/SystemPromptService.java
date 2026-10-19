package com.vc.learn.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.util.StringUtils;

/**
 * 系统提示词加载与渲染服务。
 * <p>根据 {@link SystemPromptProperties} 配置，从内联模板或资源文件加载提示词模板，
 * 并将模板中的 {变量名} 占位符替换为 variables 中配置的值，最终生成 {@link SystemMessage}。</p>
 */
@Service
public class SystemPromptService {

    private static final Logger log = LoggerFactory.getLogger(SystemPromptService.class);

    private final SystemPromptProperties properties;
    private final ResourceLoader resourceLoader;

    public SystemPromptService(SystemPromptProperties properties, ResourceLoader resourceLoader) {
        this.properties = properties;
        this.resourceLoader = resourceLoader;
    }

    /**
     * 判断系统提示词是否启用。
     */
    public boolean isEnabled() {
        return properties.isEnabled();
    }

    /**
     * 获取当前角色标识。
     */
    public String getRole() {
        return properties.getRole();
    }

    /**
     * 构建系统提示词消息。
     * <p>加载顺序：template-location 优先，其次是内联 template。</p>
     *
     * @return 渲染后的 SystemMessage，若未启用或模板为空则返回 null
     */
    public SystemMessage buildSystemMessage() {
        if (!properties.isEnabled()) {
            log.debug("系统提示词已禁用（vc.learn.system-prompt.enabled=false）");
            return null;
        }

        String template = loadTemplate();
        if (!StringUtils.hasText(template)) {
            log.warn("系统提示词模板为空，跳过系统提示词注入。role={}", properties.getRole());
            return null;
        }

        String rendered = render(template, properties.getVariables());
        log.info("已加载系统提示词，role={}，长度={}", properties.getRole(), rendered.length());
        return new SystemMessage(rendered);
    }

    /**
     * 加载模板内容：优先从 template-location 指定的资源文件读取，其次使用内联 template。
     */
    private String loadTemplate() {
        String location = properties.getTemplateLocation();
        if (StringUtils.hasText(location)) {
            try {
                Resource resource = resourceLoader.getResource(location);
                if (resource.exists()) {
                    return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
                }
                log.warn("系统提示词模板文件不存在：{}，回退到内联 template", location);
            } catch (IOException e) {
                log.error("读取系统提示词模板文件失败：{}", location, e);
            }
        }
        return properties.getTemplate();
    }

    /**
     * 将模板中的 {key} 占位符替换为 variables 中的值。
     */
    private String render(String template, Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return template;
        }
        String result = template;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            result = result.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return result;
    }
}
