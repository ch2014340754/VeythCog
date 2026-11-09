package com.vc.app.orchestration;

import com.vc.chat.ChatService;
import com.vc.knowledge.config.KnowledgeProperties;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.knowledge.service.VectorizeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * RAG 增强对话编排器。
 *
 * <p>职责边界（依赖方向保持在 app 层，chat 与 knowledge 互不 import）：</p>
 * <pre>
 *   问题 → 知识库检索（vc-knowledge）→ 拼上下文 + 引用编号 → vc-chat 作答
 * </pre>
 *
 * <p>引用（references）由后端统一产出并随 SSE 下发，前端只负责展示，
 * 避免"前端各自检索一次"导致引用与模型实际看到的上下文不一致。</p>
 */
@Component
public class RagChatOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(RagChatOrchestrator.class);

    /** 拼进 prompt 的资料正文上限（字符），防止把上下文撑爆 */
    private static final int MAX_CONTEXT_CHARS = 4000;

    private final VectorizeService vectorizeService;
    private final ChatService chatService;
    private final RagReranker reranker;
    private final KnowledgeProperties properties;

    public RagChatOrchestrator(VectorizeService vectorizeService,
                               ChatService chatService,
                               RagReranker reranker,
                               KnowledgeProperties properties) {
        this.vectorizeService = vectorizeService;
        this.chatService = chatService;
        this.reranker = reranker;
        this.properties = properties;
    }

    /**
     * 检索本次对话绑定的文档集合。
     * <p>召回失败（无向量化文档、embedding 超时、阈值内无命中）不阻塞普通对话，降级为空引用。</p>
     * <p>启用 rerank 时先多召回一些候选（默认 10 条），再用辅助小模型按相关性重排取 topN。</p>
     */
    public List<RetrieveChunk> retrieveSafely(Long userId, List<Long> docIds, String query) {
        if (docIds == null || docIds.isEmpty() || query == null || query.isBlank()) {
            return List.of();
        }
        try {
            int topN = Math.max(1, properties.getRetrieve().getTopN());
            int candidates = properties.getRetrieve().getRerank().isEnabled()
                    ? Math.max(topN, properties.getRetrieve().getRerank().getCandidates())
                    : topN;

            List<RetrieveChunk> chunks = vectorizeService.retrieve(userId, docIds, query, candidates);
            if (chunks == null || chunks.isEmpty()) {
                log.warn("RAG 召回到 0 条（将按普通对话作答）: docIds={}", docIds);
                return List.of();
            }
            List<RetrieveChunk> ranked = reranker.rerank(query, chunks, topN);
            if (ranked.isEmpty()) {
                log.warn("RAG rerank 后为空（将按普通对话作答）: docIds={}", docIds);
                return List.of();
            }
            log.info("RAG 召回命中 {} 条, rerank 后保留 {} 条, docIds={}, top={}({}), bestScore={}",
                    chunks.size(), ranked.size(), docIds, ranked.get(0).getTitle(),
                    ranked.get(0).getChunkIndex(), ranked.get(0).getScore());
            return ranked;
        } catch (Exception e) {
            // 知识库召回是增强能力，失败降级为普通对话，不向客户端抛错；但必须留痕便于排查
            log.error("RAG 召回失败，降级为普通对话: docIds={}", docIds, e);
            return List.of();
        }
    }

    /**
     * 把召回片段拼成带编号引用的用户消息。
     * <p>无召回时原样返回用户问题，保证非 RAG 对话行为不变。</p>
     */
    public String buildAugmentedMessage(String question, List<RetrieveChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return question;
        }
        StringBuilder sb = new StringBuilder(MAX_CONTEXT_CHARS + 256);
        sb.append("以下是用户知识库中检索到的参考资料。请优先依据这些资料回答；")
          .append("引用具体内容时用 [1]、[2] 这样的编号标注来源；")
          .append("资料不足以回答时请明确说明，不要编造。\n\n");

        int index = 1;
        for (RetrieveChunk chunk : chunks) {
            if (sb.length() >= MAX_CONTEXT_CHARS) {
                break;
            }
            sb.append('[').append(index++).append("] 《").append(nullToEmpty(chunk.getTitle()))
              .append("》 片段 #").append(chunk.getChunkIndex())
              .append("\n").append(nullToEmpty(chunk.getChunkText())).append("\n\n");
        }

        sb.append("用户问题：").append(question);
        return sb.toString();
    }

    /** 同步对话（/chat/message）：检索 → 拼上下文 → 作答 */
    public String answer(Long userId, List<Long> docIds, String question,
                         String vendor, String modelCode, String conversationId) {
        List<RetrieveChunk> chunks = retrieveSafely(userId, docIds, question);
        return chatService.chat(userId, vendor, modelCode, conversationId,
                buildAugmentedMessage(question, chunks));
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
