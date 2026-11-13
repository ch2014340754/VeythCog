package com.vc.chat.compress;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 上下文压缩配置：{@code chat.compress.*}。
 */
@Data
@Component
@ConfigurationProperties(prefix = "chat.compress")
public class ChatCompressProperties {

    /** 总开关；关闭后即使会话开启压缩也不生效 */
    private boolean enabled = true;

    /** 估算 token 超过该阈值才触发压缩 */
    private int thresholdTokens = 4000;

    /** 压缩后保留最近 N 轮（1 轮 = 用户 + 助手两条） */
    private int keepRounds = 3;

    /** 送去做摘要的历史文本上限（字符），避免摘要请求本身超限 */
    private int summaryInputMaxChars = 8000;
}
