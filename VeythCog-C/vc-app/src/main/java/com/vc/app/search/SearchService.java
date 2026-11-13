package com.vc.app.search;

import com.vc.app.orchestration.RagChatOrchestrator;
import com.vc.app.search.dto.SearchStatus;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.knowledge.service.VectorizeService;
import com.vc.llm.dto.LlmModelItem;
import com.vc.llm.service.LlmModelService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 搜索增强编排：联想 / 翻译 / 状态 / AI Prompt。
 */
@Service
public class SearchService {

    private final SearchSuggestService suggestService;
    private final SearchTranslateService translateService;
    private final LlmModelService llmModelService;
    private final VectorizeService vectorizeService;
    private final RagChatOrchestrator ragChatOrchestrator;

    public SearchService(SearchSuggestService suggestService,
                         SearchTranslateService translateService,
                         LlmModelService llmModelService,
                         VectorizeService vectorizeService,
                         RagChatOrchestrator ragChatOrchestrator) {
        this.suggestService = suggestService;
        this.translateService = translateService;
        this.llmModelService = llmModelService;
        this.vectorizeService = vectorizeService;
        this.ragChatOrchestrator = ragChatOrchestrator;
    }

    public List<String> suggest(String engine, String query) {
        return suggestService.suggest(engine, query);
    }

    public com.vc.app.search.dto.TranslateResult translate(String text, String targetLang) {
        return translateService.translate(text, targetLang);
    }

    public SearchStatus status(Long userId) {
        LlmModelItem model = llmModelService.getDefaultModel(userId);
        return new SearchStatus(
                vectorizeService.hasVectorizedDocs(userId),
                model == null ? null : model.getVendor(),
                model == null ? null : model.getModelCode(),
                model == null ? null : model.getModelName());
    }

    public LlmModelItem requireDefaultModel(Long userId) {
        LlmModelItem model = llmModelService.getDefaultModel(userId);
        if (model == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请先绑定一个可用模型");
        }
        return model;
    }

    public boolean hasVectorizedDocs(Long userId) {
        return vectorizeService.hasVectorizedDocs(userId);
    }

    /**
     * 构造搜索 AI 的一次性提示词。
     *
     * <p>搜索 AI 与正式对话不同：要求短、先结论、末尾提示未联网核实；
     * 知识库命中时复用现有带编号上下文，保证引用和模型输入同源。</p>
     */
    public String buildPrompt(String query, List<RetrieveChunk> references, boolean knowledgeFirst) {
        StringBuilder prompt = new StringBuilder(256);
        prompt.append("你是 VeythCog 的搜索助手。请用简洁中文回答用户问题：")
                .append("先用一两句话给结论，再列 3 到 5 条要点；")
                .append("不要展开无关背景；不确定时直接说明，不要编造来源。")
                .append("回答末尾另起一行写“AI 生成，未联网核实。”；不要自行罗列资料来源，来源由系统在回答下方统一标注。\n\n");

        if (knowledgeFirst) {
            if (references == null || references.isEmpty()) {
                prompt.append("本次已开启“优先知识库”，但知识库没有命中相关内容。")
                        .append("请基于通用知识回答，并先说明“知识库未命中，以下为通用回答”。\n\n");
            }
        } else {
            prompt.append("本次未开启知识库检索，请基于通用知识回答。\n\n");
        }

        if (references != null && !references.isEmpty()) {
            prompt.append(ragChatOrchestrator.buildAugmentedMessage(query, references));
        } else {
            prompt.append("用户问题：").append(query);
        }
        return prompt.toString();
    }
}
