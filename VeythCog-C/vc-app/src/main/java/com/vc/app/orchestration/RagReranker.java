package com.vc.app.orchestration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.knowledge.config.KnowledgeProperties;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.llm.AuxChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * RAG 检索结果 rerank：把向量召回的候选交给辅助小模型，按与问题的相关度重排。
 *
 * <p>向量召回（L2 距离）只保证语义相近，容易把"同一主题但答非所问"的片段排前面；
 * rerank 用一次小模型调用做相关性判别，显著提升引用质量。失败或关闭时保持原顺序。</p>
 */
@Component
public class RagReranker {

    private static final Logger log = LoggerFactory.getLogger(RagReranker.class);

    private static final int MAX_PROMPT_CHARS = 4000;

    private static final String SYSTEM_PROMPT = """
            你是检索结果重排器。只输出一个 JSON 数组，禁止输出解释、代码块或多余文字。
            数组元素是候选片段编号（整数，从 1 开始），按与用户问题的相关度从高到低排列。
            """;

    private final AuxChatService auxChatService;
    private final KnowledgeProperties properties;
    private final ObjectMapper objectMapper;

    public RagReranker(AuxChatService auxChatService,
                       KnowledgeProperties properties,
                       ObjectMapper objectMapper) {
        this.auxChatService = auxChatService;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 重排候选并截取前 topN。
     * <p>任何异常都返回原顺序的前 topN，保证对话链路不因 rerank 失败而中断。</p>
     */
    public List<RetrieveChunk> rerank(String question, List<RetrieveChunk> candidates, int topN) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        if (!properties.getRetrieve().getRerank().isEnabled() || candidates.size() <= 1) {
            return head(candidates, topN);
        }
        try {
            String userPrompt = buildPrompt(question, candidates);
            String raw = auxChatService.complete(SYSTEM_PROMPT, userPrompt);
            List<RetrieveChunk> ranked = applyOrder(candidates, parseIndices(raw), topN);
            if (ranked.size() < topN) {
                // 模型漏掉部分编号时，用原始距离顺序补齐
                Set<Long> chosen = new LinkedHashSet<>();
                for (RetrieveChunk c : ranked) {
                    chosen.add(key(c));
                }
                for (RetrieveChunk c : candidates) {
                    if (ranked.size() >= topN) {
                        break;
                    }
                    if (chosen.add(key(c))) {
                        ranked.add(c);
                    }
                }
            }
            log.info("RAG rerank 完成: 候选={}, 返回={}, model={}", candidates.size(), ranked.size(), auxChatService.modelId());
            return ranked;
        } catch (Exception e) {
            log.warn("RAG rerank 失败，回退向量顺序: {}", e.getMessage());
            return head(candidates, topN);
        }
    }

    private String buildPrompt(String question, List<RetrieveChunk> candidates) {
        int maxChunkChars = Math.max(120, properties.getRetrieve().getRerank().getMaxChunkChars());
        StringBuilder sb = new StringBuilder(MAX_PROMPT_CHARS + 256);
        sb.append("用户问题：").append(question).append("\n\n候选片段：\n");
        int index = 1;
        for (RetrieveChunk c : candidates) {
            if (sb.length() >= MAX_PROMPT_CHARS) {
                break;
            }
            sb.append('[').append(index++).append("] 标题：")
              .append(nullToEmpty(c.getTitle()))
              .append("｜片段 #").append(c.getChunkIndex())
              .append("\n").append(truncate(nullToEmpty(c.getChunkText()), maxChunkChars))
              .append("\n\n");
        }
        sb.append("请输出最相关的前 ").append(Math.min(properties.getRetrieve().getTopN(), candidates.size()))
          .append(" 个候选编号，JSON 数组，如 [3,1,5]。");
        return sb.toString();
    }

    private List<Integer> parseIndices(String raw) {
        List<Integer> indices = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return indices;
        }
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return indices;
        }
        try {
            JsonNode node = objectMapper.readTree(raw.substring(start, end + 1));
            if (node.isArray()) {
                for (JsonNode n : node) {
                    if (n.canConvertToInt()) {
                        indices.add(n.asInt());
                    }
                }
            }
        } catch (Exception e) {
            log.debug("rerank 结果解析失败: {}", e.getMessage());
        }
        return indices;
    }

    private List<RetrieveChunk> applyOrder(List<RetrieveChunk> candidates, List<Integer> indices, int topN) {
        List<RetrieveChunk> result = new ArrayList<>(topN);
        Set<Integer> seen = new LinkedHashSet<>();
        for (Integer idx : indices) {
            if (idx == null || idx < 1 || idx > candidates.size() || !seen.add(idx)) {
                continue;
            }
            result.add(candidates.get(idx - 1));
            if (result.size() >= topN) {
                break;
            }
        }
        return result;
    }

    private static List<RetrieveChunk> head(List<RetrieveChunk> list, int topN) {
        return list.size() <= topN ? new ArrayList<>(list) : new ArrayList<>(list.subList(0, topN));
    }

    private static Long key(RetrieveChunk c) {
        return (c.getDocId() == null ? 0L : c.getDocId()) * 100000L
                + (c.getChunkIndex() == null ? 0L : c.getChunkIndex().longValue());
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static String nullToEmpty(String v) {
        return v == null ? "" : v;
    }
}
