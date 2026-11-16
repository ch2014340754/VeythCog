package com.vc.app.quickai;

import com.vc.app.orchestration.RagChatOrchestrator;
import com.vc.chat.ChatService;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.llm.dto.LlmModelItem;
import com.vc.llm.service.LlmModelService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * 划词 AI：一次性问答（无记忆）。
 *
 * <p>不写 {@code chat_message}：划词是"看一眼就关"的动作，落到对话历史里只会把会话列表撑满。
 * 复用 {@link ChatService#streamChatStateless}，与 AI 搜索同一条通路。</p>
 */
@Service
public class QuickAiService {

    private static final Logger log = LoggerFactory.getLogger(QuickAiService.class);

    /** 选中文本上限：超出截断，避免把整篇文章塞进 prompt */
    public static final int MAX_TEXT_CHARS = 3000;

    private static final String ACTION_EXPLAIN = "explain";
    private static final String ACTION_TRANSLATE = "translate";
    private static final String ACTION_POLISH = "polish";
    private static final String ACTION_ASK = "ask";

    private final LlmModelService llmModelService;
    private final ChatService chatService;
    private final RagChatOrchestrator ragChatOrchestrator;
    private final QuickAiCache cache;

    public QuickAiService(LlmModelService llmModelService,
                          ChatService chatService,
                          RagChatOrchestrator ragChatOrchestrator,
                          QuickAiCache cache) {
        this.llmModelService = llmModelService;
        this.chatService = chatService;
        this.ragChatOrchestrator = ragChatOrchestrator;
        this.cache = cache;
    }

    /**
     * 一次请求的准备结果：模型、引用、最终 prompt、缓存命中情况。
     */
    public record Prepared(LlmModelItem model, List<RetrieveChunk> references,
                           String prompt, String cachedText, Long cachedAt, String cacheKey) {
        public boolean cached() {
            return cachedText != null;
        }
    }

    public Prepared prepare(Long userId, String action, String rawText, String pageTitle,
                            boolean withKnowledge, String question, boolean noCache) {
        String normalizedAction = normalizeAction(action);
        String text = normalizeText(rawText);
        LlmModelItem model = llmModelService.getDefaultModel(userId);
        if (model == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请先在设置里绑定一个可用模型");
        }

        // 只有纯模型动作才缓存；问答与"结合知识库"不缓存（上下文会变）
        boolean cacheable = !withKnowledge && !ACTION_ASK.equals(normalizedAction);
        String cacheKey = cacheable
                ? sha256(normalizedAction + "|" + text + "|" + model.getModelCode() + "|kb0")
                : null;
        if (cacheable && !noCache) {
            String hit = cache.get(cacheKey);
            if (hit != null) {
                return new Prepared(model, List.of(), "", hit, cache.cachedAt(cacheKey), cacheKey);
            }
        }

        List<RetrieveChunk> references = withKnowledge
                ? ragChatOrchestrator.retrieveAllSafely(userId, text)
                : List.of();
        String basePrompt = buildPrompt(normalizedAction, text, pageTitle, question);
        String prompt = references.isEmpty() ? basePrompt
                : ragChatOrchestrator.buildAugmentedMessage(basePrompt, references);
        return new Prepared(model, references, prompt, null, null, cacheKey);
    }

    /** 真正的模型调用（无记忆流式） */
    public Flux<String> stream(Long userId, Prepared prepared) {
        return chatService.streamChatStateless(userId, prepared.model().getVendor(),
                prepared.model().getModelCode(), prepared.prompt());
    }

    /** 生成完成后写缓存 */
    public void remember(Prepared prepared, String fullText) {
        if (prepared.cacheKey() == null || fullText == null || fullText.isBlank()) {
            return;
        }
        cache.put(prepared.cacheKey(), fullText);
        log.debug("划词结果已缓存: key={}, chars={}", prepared.cacheKey(), fullText.length());
    }

    /** 前端"清空划词缓存"用 */
    public void clearCache() {
        cache.clear();
    }

    private String normalizeAction(String action) {
        String value = action == null ? "" : action.trim().toLowerCase();
        return switch (value) {
            case ACTION_TRANSLATE, ACTION_POLISH, ACTION_ASK -> value;
            default -> ACTION_EXPLAIN;
        };
    }

    private String normalizeText(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "选中内容为空");
        }
        String text = rawText.replace("\r\n", "\n").trim();
        return text.length() <= MAX_TEXT_CHARS ? text : text.substring(0, MAX_TEXT_CHARS);
    }

    /**
     * 各动作的提示词。指令在服务端拼装，前端只能传动作名，不能注入自己的 system prompt。
     */
    private String buildPrompt(String action, String text, String pageTitle, String question) {
        String where = pageTitle == null || pageTitle.isBlank() ? "" : "（页面：" + pageTitle.trim() + "）";
        return switch (action) {
            case ACTION_TRANSLATE -> "把下面这段内容翻译为另一种语言（中文→英文，其他语言→中文）。"
                    + "只输出译文本身，不要解释、不要加引号、不要保留原文。\n\n" + text;
            case ACTION_POLISH -> "在保持原意与语言不变的前提下，把下面这段内容改得更简洁、通顺、专业。"
                    + "只输出改写后的结果，不要说明改了什么。\n\n" + text;
            case ACTION_ASK -> "请以下面这段内容为上下文回答问题。"
                    + (question == null || question.isBlank() ? "概括它的要点。" : "问题：" + question.trim())
                    + "\n\n上下文：\n" + text;
            default -> "用中文解释下面这段内容" + where + "。要求："
                    + "先给一句话结论，再用要点说明（必要时举例）；"
                    + "若是代码，指出它的意图与潜在风险；若是报错，指出原因与修复方向。"
                    + "不要复述原文，不要客套。\n\n" + text;
        };
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return toHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
