package com.vc.chat.compress;

import com.vc.llm.LlmChatService;
import com.vc.llm.metrics.TokenEstimator;
import com.vc.llm.router.LlmModelRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 上下文动态压缩：超过 token 阈值时，把最早的历史交给当前会话模型摘要成一条 system 消息，
 * 保留最近 N 轮原文继续对话。
 *
 * <p>失败降级：摘要调用失败（额度/限流/网络）不会阻断对话，直接丢弃最早历史，
 * 只保留最近 N 轮，保证本轮请求仍能继续。</p>
 *
 * <p>记忆写入是全量覆盖（{@code saveAll} 先删后插），因此这里通过
 * {@link ChatMemory#clear(String)} + {@link ChatMemory#add(String, List)} 重写整个记忆列表。</p>
 */
@Component
public class ContextCompressor {

    private static final Logger log = LoggerFactory.getLogger(ContextCompressor.class);

    private static final String SUMMARY_HEAD = "以下是此前对话的摘要（原始历史已压缩）：\n";

    private final ChatMemory chatMemory;
    private final LlmChatService llmChatService;
    private final ChatCompressProperties properties;

    public ContextCompressor(ChatMemory chatMemory, LlmChatService llmChatService,
                             ChatCompressProperties properties) {
        this.chatMemory = chatMemory;
        this.llmChatService = llmChatService;
        this.properties = properties;
    }

    /**
     * 按需压缩会话记忆。
     *
     * @param incomingMessage 本轮将要发送给模型的用户消息（参与 token 预估）
     * @param sessionEnabled  会话级开关
     * @return 是否发生了压缩（含降级丢弃）
     */
    public boolean maybeCompress(Long userId, String vendor, String modelCode,
                                 String conversationId, String incomingMessage,
                                 boolean sessionEnabled) {
        if (!properties.isEnabled() || !sessionEnabled
                || conversationId == null || conversationId.isBlank()) {
            return false;
        }
        String memoryKey = LlmModelRouter.memoryKey(userId, conversationId);
        List<Message> history = chatMemory.get(memoryKey);
        if (history == null || history.isEmpty()) {
            return false;
        }

        int totalTokens = estimate(history) + TokenEstimator.estimate(incomingMessage);
        if (totalTokens <= properties.getThresholdTokens()) {
            return false;
        }

        int keepMessages = Math.max(2, properties.getKeepRounds() * 2);
        if (history.size() <= keepMessages) {
            return false;
        }

        int splitAt = history.size() - keepMessages;
        List<Message> head = new ArrayList<>(history.subList(0, splitAt));
        List<Message> tail = new ArrayList<>(history.subList(splitAt, history.size()));

        String summary = null;
        try {
            summary = llmChatService.chatStateless(userId, vendor, modelCode, buildSummaryPrompt(head));
        } catch (RuntimeException e) {
            log.warn("上下文摘要失败，降级丢弃最早历史 user={} conversation={} reason={}",
                    userId, conversationId, e.getMessage());
        }

        List<Message> rewritten = new ArrayList<>();
        if (summary != null && !summary.isBlank()) {
            rewritten.add(new SystemMessage(SUMMARY_HEAD + summary.trim()));
        }
        rewritten.addAll(tail);

        chatMemory.clear(memoryKey);
        chatMemory.add(memoryKey, rewritten);
        log.info("上下文压缩完成 user={} conversation={} before={} after={} summarized={}",
                userId, conversationId, history.size(), rewritten.size(), summary != null && !summary.isBlank());
        return true;
    }

    private String buildSummaryPrompt(List<Message> head) {
        StringBuilder sb = new StringBuilder();
        sb.append("请把下面这段对话压缩成一段简洁的中文摘要，保留关键事实、结论、用户偏好和未完成事项；")
                .append("不要编造，不要逐句复述。只输出摘要正文。\n\n");
        StringBuilder body = new StringBuilder();
        for (Message m : head) {
            String role = m instanceof UserMessage ? "用户"
                    : m instanceof AssistantMessage ? "助手"
                    : m instanceof SystemMessage ? "系统" : "其他";
            body.append(role).append("：").append(m.getText()).append('\n');
        }
        String text = body.toString();
        int max = properties.getSummaryInputMaxChars();
        if (text.length() > max) {
            text = text.substring(text.length() - max);
        }
        sb.append(text);
        return sb.toString();
    }

    private static int estimate(List<Message> messages) {
        int total = 0;
        for (Message m : messages) {
            total += TokenEstimator.estimate(m.getText());
        }
        return total;
    }
}
