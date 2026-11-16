package com.vc.app.web;

import com.vc.app.quickai.QuickAiService;
import com.vc.app.search.SearchService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.dto.LlmModelItem;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 全局划词 AI。
 *
 * <ul>
 *   <li>{@code POST /ai/quick} —— SSE 一次性问答（meta → references → data(token) → [DONE]）</li>
 *   <li>{@code GET /ai/quick/models} —— 当前账号可用的模型，供结果卡显示"由谁回答"</li>
 *   <li>{@code DELETE /ai/quick/cache} —— 清空后端划词缓存</li>
 * </ul>
 */
@RestController
@RequestMapping("/ai")
public class QuickAiController {

    private final QuickAiService quickAiService;
    private final SearchService searchService;

    public QuickAiController(QuickAiService quickAiService, SearchService searchService) {
        this.quickAiService = quickAiService;
        this.searchService = searchService;
    }

    @PostMapping(value = "/quick", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter quick(@Valid @RequestBody QuickAiRequest request) {
        Long userId = currentUserId();
        boolean withKnowledge = Boolean.TRUE.equals(request.getWithKnowledge());
        boolean noCache = Boolean.TRUE.equals(request.getNocache());
        boolean knowledgeAvailable = searchService.hasVectorizedDocs(userId);

        QuickAiService.Prepared prepared = quickAiService.prepare(
                userId, request.getAction(), request.getText(), request.getPageTitle(),
                withKnowledge, request.getQuestion(), noCache);

        SseEmitter emitter = new SseEmitter(0L);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("modelName", prepared.model().getModelName());
        meta.put("withKnowledge", withKnowledge);
        meta.put("knowledgeAvailable", knowledgeAvailable);
        meta.put("knowledgeHit", !prepared.references().isEmpty());
        boolean cached = prepared.cached();
        meta.put("cached", cached);
        meta.put("cachedAt", prepared.cachedAt());
        meta.put("action", request.getAction());
        try {
            emitter.send(SseEmitter.event().name("meta").data(meta, MediaType.APPLICATION_JSON));
            emitter.send(SseEmitter.event().name("references")
                    .data(prepared.references(), MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitter.completeWithError(e);
            return emitter;
        }

        // 缓存命中：直接把整段结果一次性推给前端（前端仍按 token 流处理，不必区分两条路径）
        if (cached) {
            try {
                emitter.send(SseEmitter.event().data(prepared.cachedText()));
                emitter.send(SseEmitter.event().data("[DONE]"));
            } catch (IOException ignored) {
            }
            emitter.complete();
            return emitter;
        }

        Flux<String> flux;
        try {
            flux = quickAiService.stream(userId, prepared);
        } catch (RuntimeException e) {
            sendError(emitter, e);
            return emitter;
        }

        StringBuilder collected = new StringBuilder();
        Disposable disposable = flux.subscribe(
                token -> {
                    if (token == null || token.isEmpty()) {
                        return;
                    }
                    collected.append(token);
                    try {
                        emitter.send(SseEmitter.event().data(token));
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                },
                error -> sendError(emitter, error),
                () -> {
                    quickAiService.remember(prepared, collected.toString());
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

    @GetMapping("/quick/models")
    public BaseResponse<List<Map<String, Object>>> models() {
        List<LlmModelItem> models = searchService.listModels(currentUserId());
        List<Map<String, Object>> views = new ArrayList<>(models.size());
        for (LlmModelItem model : models) {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("modelName", model.getModelName());
            view.put("modelCode", model.getModelCode());
            view.put("vendor", model.getVendor());
            views.add(view);
        }
        return ResultUtils.success(views);
    }

    @DeleteMapping("/quick/cache")
    public BaseResponse<Void> clearCache() {
        quickAiService.clearCache();
        return ResultUtils.success(null);
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
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
