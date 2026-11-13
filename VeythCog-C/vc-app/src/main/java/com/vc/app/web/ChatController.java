package com.vc.app.web;

import com.vc.app.orchestration.RagChatOrchestrator;
import com.vc.chat.ChatHistoryService;
import com.vc.chat.ChatService;
import com.vc.chat.dto.ChatConversationVO;
import com.vc.chat.dto.ChatMessageVO;
import com.vc.chat.dto.ChatSessionVO;
import com.vc.chat.service.ChatSessionService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.dto.RetrieveChunk;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.util.List;

/**
 * 对话接口：统一单入口，按 vendor + modelCode 路由。
 * <ul>
 *   <li>POST /chat/message —— 同步返回完整回复</li>
 *   <li>POST /chat/stream —— SSE 流式，逐 token 下发，降低首响应时延</li>
 * </ul>
 *
 * <p>RAG：请求携带 {@code docIds} 时，由 {@link RagChatOrchestrator} 统一检索并拼上下文；
 * 引用（references）由后端产出，流式场景先下发一条 {@code event: references}，
 * 再逐 token 下发正文，保证"模型看到的"与"前端展示的"是同一份引用。</p>
 */
@RestController
@RequestMapping("/chat")
public class ChatController {

    private final ChatService chatService;
    private final ChatHistoryService chatHistoryService;
    private final RagChatOrchestrator ragChatOrchestrator;
    private final ChatSessionService chatSessionService;

    public ChatController(ChatService chatService,
                          ChatHistoryService chatHistoryService,
                          RagChatOrchestrator ragChatOrchestrator,
                          ChatSessionService chatSessionService) {
        this.chatService = chatService;
        this.chatHistoryService = chatHistoryService;
        this.ragChatOrchestrator = ragChatOrchestrator;
        this.chatSessionService = chatSessionService;
    }

    /** 会话列表：来自 chat_message 记忆表（无独立会话表，按账号前缀隔离） */
    @GetMapping("/conversations")
    public BaseResponse<List<ChatConversationVO>> conversations() {
        return ResultUtils.success(chatHistoryService.listConversations(currentUserId()));
    }

    /** 会话消息：刷新页面 / 切换会话时回显真实历史 */
    @GetMapping("/conversations/{conversationId}/messages")
    public BaseResponse<List<ChatMessageVO>> conversationMessages(@PathVariable String conversationId) {
        return ResultUtils.success(chatHistoryService.listMessages(currentUserId(), conversationId));
    }

    /** 删除会话：清空该会话的记忆行并软删除会话配置 */
    @DeleteMapping("/conversations/{conversationId}")
    public BaseResponse<Boolean> deleteConversation(@PathVariable String conversationId) {
        return ResultUtils.success(chatHistoryService.deleteConversation(currentUserId(), conversationId));
    }

    /** 新建会话（会话级模型 / 文档集合 / 压缩开关随会话持久化） */
    @PostMapping("/sessions")
    public BaseResponse<ChatSessionVO> createSession(@RequestBody ChatSessionRequest body) {
        return ResultUtils.success(chatSessionService.create(
                currentUserId(), body.getConversationId(), body.getTitle(),
                body.getVendor(), body.getModelCode(), body.getDocIds(), body.getCompressEnabled()));
    }

    /** 会话配置列表 */
    @GetMapping("/sessions")
    public BaseResponse<List<ChatSessionVO>> sessions() {
        return ResultUtils.success(chatSessionService.list(currentUserId()));
    }

    /** 会话配置详情 */
    @GetMapping("/sessions/{conversationId}")
    public BaseResponse<ChatSessionVO> session(@PathVariable String conversationId) {
        return ResultUtils.success(chatSessionService.find(currentUserId(), conversationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "会话不存在")));
    }

    /** 更新会话配置：模型 / 标题 / 文档集合 / 压缩开关 */
    @PutMapping("/sessions/{conversationId}")
    public BaseResponse<ChatSessionVO> updateSession(@PathVariable String conversationId,
                                                     @RequestBody ChatSessionRequest body) {
        return ResultUtils.success(chatSessionService.update(
                currentUserId(), conversationId, body.getTitle(),
                body.getVendor(), body.getModelCode(), body.getDocIds(), body.getCompressEnabled()));
    }

    /** 删除会话配置（消息行由 /chat/conversations 一并处理） */
    @DeleteMapping("/sessions/{conversationId}")
    public BaseResponse<Boolean> deleteSession(@PathVariable String conversationId) {
        return ResultUtils.success(chatSessionService.delete(currentUserId(), conversationId));
    }

    @PostMapping("/message")
    public BaseResponse<String> chat(@Valid @RequestBody ChatRequest body) {
        ChatSessionVO session = chatSessionService.resolveForSend(
                currentUserId(), body.getConversationId(), body.getVendor(), body.getModelCode(),
                body.getDocIds(), body.getCompressEnabled(), body.getMessage());
        return ResultUtils.success(ragChatOrchestrator.answer(
                currentUserId(), session.getDocIds(), body.getMessage(),
                session.getVendor(), session.getModelCode(), session.getConversationId(),
                Boolean.TRUE.equals(session.getCompressEnabled())));
    }

    /**
     * 流式对话（SSE）。事件顺序：
     * <ol>
     *   <li>{@code event: references} —— 本次召回的引用片段数组（JSON，可为空数组）</li>
     *   <li>{@code data: <token>} —— 逐 token 正文，末尾 {@code data: [DONE]}</li>
     *   <li>{@code event: error} —— 模型调用失败</li>
     * </ol>
     * 客户端通过 fetch + ReadableStream 解析，中断时断开连接即取消上游生成。
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody ChatRequest body) {
        Long userId = currentUserId();
        ChatSessionVO session = chatSessionService.resolveForSend(
                userId, body.getConversationId(), body.getVendor(), body.getModelCode(),
                body.getDocIds(), body.getCompressEnabled(), body.getMessage());
        List<Long> docIds = session.getDocIds();
        // 先检索再建流：召回结果与随后喂给模型的上下文同源，避免前端展示与模型输入不一致
        List<RetrieveChunk> references = ragChatOrchestrator.retrieveSafely(
                userId, docIds, body.getMessage());
        String prompt = ragChatOrchestrator.buildAugmentedMessage(body.getMessage(), references);

        SseEmitter emitter = new SseEmitter(0L); // 不设超时，由客户端断开控制
        try {
            emitter.send(SseEmitter.event()
                    .name("references")
                    .data(references, MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            emitter.completeWithError(e);
            return emitter;
        }

        Flux<String> flux;
        try {
            flux = chatService.streamChat(
                    userId, session.getVendor(), session.getModelCode(),
                    session.getConversationId(), prompt,
                    Boolean.TRUE.equals(session.getCompressEnabled()));
        } catch (RuntimeException e) {
            // 已在 SSE 通道内（references 已下发），模型/校验类错误必须以 error 事件结束，
            // 不能抛回 MVC 让统一异常处理改写成 JSON，否则前端会把错误当空回复
            try {
                emitter.send(SseEmitter.event()
                        .name("error")
                        .data(e.getMessage() == null ? "模型调用失败" : e.getMessage()));
            } catch (IOException ignored) {
            }
            emitter.complete();
            return emitter;
        }

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
