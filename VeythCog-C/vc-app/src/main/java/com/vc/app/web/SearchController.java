package com.vc.app.web;

import com.vc.app.orchestration.RagChatOrchestrator;
import com.vc.app.search.SearchService;
import com.vc.app.search.dto.SearchAiRequest;
import com.vc.app.search.dto.SearchStatus;
import com.vc.app.search.dto.TranslateRequest;
import com.vc.app.search.dto.TranslateResult;
import com.vc.chat.ChatService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.llm.dto.LlmModelItem;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 导航搜索增强接口。
 *
 * <ul>
 *   <li>GET /search/suggest —— 搜索引擎联想代理（远端失败返回空）</li>
 *   <li>POST /search/translate —— 首行翻译（输入内容 → 中/英）</li>
 *   <li>GET /search/status —— 知识库开关可用性与默认模型</li>
 *   <li>POST /search/ai/stream —— 无记忆 AI 回答 SSE</li>
 * </ul>
 */
@RestController
@RequestMapping("/search")
public class SearchController {

    private final SearchService searchService;
    private final RagChatOrchestrator ragChatOrchestrator;
    private final ChatService chatService;

    public SearchController(SearchService searchService,
                            RagChatOrchestrator ragChatOrchestrator,
                            ChatService chatService) {
        this.searchService = searchService;
        this.ragChatOrchestrator = ragChatOrchestrator;
        this.chatService = chatService;
    }

    @GetMapping("/suggest")
    public BaseResponse<List<String>> suggest(@RequestParam(name = "q", required = false) String query,
                                              @RequestParam(name = "engine", required = false, defaultValue = "baidu") String engine) {
        return ResultUtils.success(searchService.suggest(engine, query));
    }

    @PostMapping("/translate")
    public BaseResponse<TranslateResult> translate(@Valid @RequestBody TranslateRequest request) {
        return ResultUtils.success(searchService.translate(request.getText(), request.getTargetLang()));
    }

    @GetMapping("/status")
    public BaseResponse<SearchStatus> status() {
        return ResultUtils.success(searchService.status(currentUserId()));
    }

    /**
     * 搜索 AI 回答：SSE 事件顺序 meta → references → data(token) → [DONE]。
     * <p>不创建 conversationId，也不写对话记忆；继续追问由前端跳转正式对话页。</p>
     */
    @PostMapping(value = "/ai/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter aiStream(@Valid @RequestBody SearchAiRequest request) {
        Long userId = currentUserId();
        LlmModelItem model = searchService.requireDefaultModel(userId);
        boolean knowledgeFirst = Boolean.TRUE.equals(request.getKnowledgeFirst());
        boolean knowledgeAvailable = searchService.hasVectorizedDocs(userId);

        List<RetrieveChunk> references = knowledgeFirst && knowledgeAvailable
                ? ragChatOrchestrator.retrieveAllSafely(userId, request.getQuery())
                : List.of();
        String prompt = searchService.buildPrompt(request.getQuery(), references, knowledgeFirst);

        SseEmitter emitter = new SseEmitter(0L);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("modelName", model.getModelName());
        meta.put("knowledgeFirst", knowledgeFirst);
        meta.put("knowledgeAvailable", knowledgeAvailable);
        meta.put("knowledgeHit", !references.isEmpty());
        try {
            emitter.send(SseEmitter.event()
                    .name("meta")
                    .data(meta, MediaType.APPLICATION_JSON));
            emitter.send(SseEmitter.event()
                    .name("references")
                    .data(references, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitter.completeWithError(e);
            return emitter;
        }

        Flux<String> flux;
        try {
            flux = chatService.streamChatStateless(
                    userId, model.getVendor(), model.getModelCode(), prompt);
        } catch (RuntimeException e) {
            sendError(emitter, e);
            return emitter;
        }

        Disposable disposable = flux.subscribe(
                token -> {
                    if (token == null || token.isEmpty()) {
                        return;
                    }
                    try {
                        emitter.send(SseEmitter.event().data(token));
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                },
                error -> sendError(emitter, error),
                () -> {
                    try {
                        emitter.send(SseEmitter.event().data("[DONE]"));
                    } catch (IOException ignored) {
                    }
                    emitter.complete();
                });

        emitter.onCompletion(disposable::dispose);
        emitter.onTimeout(disposable::dispose);
        return emitter;
    }

    private void sendError(SseEmitter emitter, Throwable error) {
        try {
            String message = error.getMessage() == null ? "模型调用失败" : error.getMessage();
            emitter.send(SseEmitter.event().name("error").data(message));
        } catch (IOException ignored) {
        }
        emitter.complete();
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new com.vc.common.exception.BusinessException(
                    com.vc.common.exception.ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
