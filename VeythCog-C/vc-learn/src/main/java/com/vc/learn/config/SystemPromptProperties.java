package com.vc.learn.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

/**
 * 系统提示词配置（读取 vc.learn.system-prompt.*）。
 * <p>支持两种模板来源：</p>
 * <ul>
 *   <li>内联模板：直接在配置文件中写 template 文本</li>
 *   <li>资源文件：通过 template-location 指定 classpath 下的模板文件（如 classpath:prompts/tcm-doctor.md）</li>
 * </ul>
 * <p>模板中可使用 {变量名} 占位符，运行时由 variables 中的值替换。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "vc.learn.system-prompt")
public class SystemPromptProperties {

    /** 是否启用系统提示词 */
    private boolean enabled = true;

    /** 角色标识，仅用于日志和区分不同角色配置 */
    private String role = "default";

    /** 内联系统提示词模板（与 template-location 二选一，template-location 优先） */
    private String template = "";

    /** 模板文件位置（classpath: 前缀），优先级高于 template */
    private String templateLocation = "";

    /** 模板变量替换映射，key 为占位符名（不含花括号），value 为替换值 */
    private Map<String, String> variables = new HashMap<>();
}
