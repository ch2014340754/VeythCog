package com.vc.app.web;

import com.vc.chat.ChatService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;

/**
 * 对话接口：统一单入口，按 vendor + modelCode 路由。
 * <ul>
 *   <li>POST /chat/message —— 同步返回完整回复</li>
 *   <li>POST /chat/stream —— SSE 流式，逐 token 下发，降低首响应时延</li>
 * </ul>
 */
@RestController
@RequestMapping("/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/message")
    public BaseResponse<String> chat(@Valid @RequestBody ChatRequest body) {
        return ResultUtils.success(chatService.chat(
                currentUserId(), body.getVendor(), body.getModelCode(),
                body.getConversationId(), body.getMessage()));
    }

    /**
     * 流式对话（SSE）。每个事件 data: <token>，末尾 data: [DONE] 结束；
     * 客户端通过 fetch + ReadableStream 解析，中断时断开连接即取消上游生成。
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody ChatRequest body) {
        SseEmitter emitter = new SseEmitter(0L); // 不设超时，由客户端断开控制
        Flux<String> flux = chatService.streamChat(
                currentUserId(), body.getVendor(), body.getModelCode(),
                body.getConversationId(), body.getMessage());

        Disposable disposable = flux.subscribe(
                token -> {
                    if (token == null || token.isEmpty()) return;
                    try {
                        emitter.send(SseEmitter.event().data(token));
                    } catch (IOException e) {
                        // 客户端已断开，取消上游订阅
                        throw new RuntimeException(e);
                    }
                },
                error -> {
                    try {
                        emitter.send(SseEmitter.event()
                                .name("error")
                                .data(error.getMessage() == null ? "模型调用失败" : error.getMessage()));
                    } catch (IOException ignored) {
                    }
                    emitter.complete();
                },
                () -> {
                    try {
                        emitter.send(SseEmitter.event().data("[DONE]"));
                    } catch (IOException ignored) {
                    }
                    emitter.complete();
                });

        // 客户端断开 / 超时 → 取消订阅，避免上游继续生成
        emitter.onCompletion(disposable::dispose);
        emitter.onTimeout(disposable::dispose);
        return emitter;
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
