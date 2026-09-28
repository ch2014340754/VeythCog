package com.vc.app.web;

import com.vc.chat.ChatService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 对话接口：统一单入口，按 vendor + modelCode 路由（同步）。
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
                currentUserId(), body.getVendor(), body.getModelCode(), body.getMessage()));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
