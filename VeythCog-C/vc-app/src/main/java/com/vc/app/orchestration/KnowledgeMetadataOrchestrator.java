package com.vc.app.orchestration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.knowledge.dto.DocDetail;
import com.vc.knowledge.service.KnowledgeService;
import com.vc.llm.AuxChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * 文档元数据（摘要 / 标签）自动生成编排器。
 *
 * <p>依赖方向保持在 app 层：vc-knowledge 只提供读写，vc-llm 提供辅助小模型，
 * 由本编排器拼提示词、解析 JSON、决定"填还是留"。</p>
 *
 * <p>策略（与用户确认）：</p>
 * <ul>
 *   <li>向量化时**只填空值**，手写的摘要/标签一律不覆盖；</li>
 *   <li>生成失败不阻断向量化，只记 warn 日志；</li>
 *   <li>需要覆盖时由前端"AI 重新生成"按钮显式触发 {@link #regenerate}。</li>
 * </ul>
 */
@Component
public class KnowledgeMetadataOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeMetadataOrchestrator.class);

    /** 送入模型的正文字符上限，避免长文档把 token 拉满 */
    private static final int MAX_DOC_CHARS = 2400;
    private static final int MAX_SUMMARY_CHARS = 60;
    private static final int MAX_TAGS = 5;
    private static final long AWAIT_SECONDS = 20;

    private static final String SYSTEM_PROMPT = """
            你是知识库文档的元数据抽取器。只输出一个 JSON 对象，禁止输出解释、Markdown 代码块或多余文字。
            字段要求：
            - summary：一句话中文摘要，不超过 60 个汉字，说明文档讲什么、结论是什么；不要以"本文/该文档"开头，不加书名号。
            - tags：2~5 个中文短标签，每个 2~6 个字，覆盖主题、技术栈或业务场景，不含标点与 # 号。
            输出格式：{"summary":"...","tags":["...","..."]}
            """;

    private final KnowledgeService knowledgeService;
    private final AuxChatService auxChatService;
    private final ObjectMapper objectMapper;

    public KnowledgeMetadataOrchestrator(KnowledgeService knowledgeService,
                                         AuxChatService auxChatService,
                                         ObjectMapper objectMapper) {
        this.knowledgeService = knowledgeService;
        this.auxChatService = auxChatService;
        this.objectMapper = objectMapper;
    }

    /**
     * 只调用模型生成元数据（不落库），供向量化链路与 embedding 并行执行。
     * <p>失败返回 null，不影响主流程。</p>
     */
    public DocMetadata generate(Long userId, Long docId) {
        try {
            DocDetail doc = knowledgeService.get(userId, docId);
            // "仅填空值"：摘要与标签都已存在时直接跳过，省一次模型调用
            if (trimToNull(doc.getSummary()) != null && doc.getTags() != null && !doc.getTags().isEmpty()) {
                log.debug("元数据已完整，跳过生成: docId={}", docId);
                return null;
            }
            String content = doc.getMarkdownText() == null ? "" : doc.getMarkdownText();
            if (content.isBlank()) {
                return null;
            }
            String userPrompt = "文档标题：" + nullToEmpty(doc.getTitle())
                    + "\n\n文档内容：\n" + truncate(content, MAX_DOC_CHARS);
            String raw = auxChatService.complete(SYSTEM_PROMPT, userPrompt);
            DocMetadata meta = parse(raw);
            if (meta == null) {
                log.warn("元数据生成结果无法解析, docId={}, model={}, raw={}",
                        docId, auxChatService.modelId(), truncate(nullToEmpty(raw), 200));
            }
            return meta;
        } catch (Exception e) {
            log.warn("元数据生成失败（不影响向量化）, docId={}, model={}, reason={}",
                    docId, auxChatService.modelId(), e.getMessage());
            return null;
        }
    }

    /** 与 embedding 并行的异步生成，返回 null 表示失败/跳过的安全结果 */
    public CompletableFuture<DocMetadata> generateAsync(Long userId, Long docId) {
        return CompletableFuture.supplyAsync(() -> generate(userId, docId));
    }

    /** 等待异步结果，超时或异常一律降级为 null，绝不阻塞向量化成功响应 */
    public DocMetadata awaitSafely(CompletableFuture<DocMetadata> future) {
        if (future == null) {
            return null;
        }
        try {
            return future.orTimeout(AWAIT_SECONDS, TimeUnit.SECONDS).join();
        } catch (Exception e) {
            log.warn("等待元数据生成超时/失败，跳过填充: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 只用生成结果补齐空值并落库；已有内容不动。
     * @return 最终生效的元数据（用于接口回传给前端）
     */
    public DocMetadata fillIfBlank(Long userId, Long docId, DocMetadata generated) {
        DocDetail doc = knowledgeService.get(userId, docId);
        String summary = trimToNull(doc.getSummary());
        List<String> tags = doc.getTags() == null ? List.of() : doc.getTags();

        String newSummary = null;
        List<String> newTags = null;
        if (generated != null) {
            if (summary == null && trimToNull(generated.getSummary()) != null) {
                newSummary = generated.getSummary().trim();
            }
            if (tags.isEmpty() && generated.getTags() != null && !generated.getTags().isEmpty()) {
                newTags = generated.getTags();
            }
        }
        if (newSummary == null && newTags == null) {
            return new DocMetadata(summary, tags);
        }
        knowledgeService.updateMetadata(userId, docId, newSummary, newTags);
        return new DocMetadata(
                newSummary != null ? newSummary : summary,
                newTags != null ? newTags : tags);
    }

    /**
     * 显式重新生成并覆盖（前端"AI 重新生成"按钮）。
     * <p>与向量化不同，这里覆盖是用户主动确认的行为，失败直接抛给调用方提示。</p>
     */
    public DocMetadata regenerate(Long userId, Long docId) {
        DocDetail doc = knowledgeService.get(userId, docId);
        String content = doc.getMarkdownText() == null ? "" : doc.getMarkdownText();
        if (content.isBlank()) {
            throw new com.vc.common.exception.BusinessException(
                    com.vc.common.exception.ErrorCode.PARAMS_ERROR, "文档内容为空，无法生成元数据");
        }
        String userPrompt = "文档标题：" + nullToEmpty(doc.getTitle())
                + "\n\n文档内容：\n" + truncate(content, MAX_DOC_CHARS);
        String raw = auxChatService.complete(SYSTEM_PROMPT, userPrompt);
        DocMetadata meta = parse(raw);
        if (meta == null || meta.getSummary() == null || meta.getTags() == null || meta.getTags().isEmpty()) {
            throw new com.vc.common.exception.BusinessException(
                    com.vc.common.exception.ErrorCode.OPERATION_ERROR, "模型返回的元数据无法解析");
        }
        knowledgeService.updateMetadata(userId, docId, meta.getSummary(), meta.getTags());
        return meta;
    }

    // ---------------- 私有辅助 ----------------

    /** 解析模型输出：容忍 ```json 包裹与前后多余文本 */
    private DocMetadata parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            int start = raw.indexOf('{');
            int end = raw.lastIndexOf('}');
            if (start < 0 || end <= start) {
                return null;
            }
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            String summary = trimToNull(node.path("summary").asText(null));
            if (summary != null) {
                summary = truncate(summary.replaceAll("\\s+", " "), MAX_SUMMARY_CHARS);
            }
            List<String> tags = sanitizeTags(node.path("tags"));
            if (summary == null && tags.isEmpty()) {
                return null;
            }
            return new DocMetadata(summary, tags);
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> sanitizeTags(JsonNode tagsNode) {
        Set<String> unique = new LinkedHashSet<>();
        if (tagsNode != null && tagsNode.isArray()) {
            for (JsonNode n : tagsNode) {
                String tag = trimToNull(n.asText(null));
                if (tag == null) {
                    continue;
                }
                tag = tag.replace("#", "").replaceAll("[,，。；;、\\s]", "").trim();
                if (!tag.isEmpty() && tag.length() <= 12) {
                    unique.add(tag);
                }
                if (unique.size() >= MAX_TAGS) {
                    break;
                }
            }
        }
        return new ArrayList<>(unique);
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String trimToNull(String v) {
        if (v == null) {
            return null;
        }
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }

    private static String nullToEmpty(String v) {
        return v == null ? "" : v;
    }
}
