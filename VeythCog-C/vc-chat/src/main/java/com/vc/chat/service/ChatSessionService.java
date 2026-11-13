package com.vc.chat.service;

import com.vc.chat.dto.ChatSessionVO;
import com.vc.chat.entity.ChatSession;
import com.vc.chat.repository.ChatSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 会话级配置服务：模型 / 知识库文档集合 / 上下文压缩开关。
 *
 * <p>会话是配置的唯一权威来源；发消息时按会话配置取模型与文档集合，
 * 前端每次改动都会先写回本服务。</p>
 */
@Service
public class ChatSessionService {

    private static final int TITLE_MAX = 30;

    private final ChatSessionRepository repository;

    public ChatSessionService(ChatSessionRepository repository) {
        this.repository = repository;
    }

    /** 新建会话（已存在则更新配置） */
    @Transactional
    public ChatSessionVO create(Long userId, String conversationId, String title,
                                String vendor, String modelCode,
                                List<Long> docIds, Boolean compressEnabled) {
        String id = StringUtils.hasText(conversationId) ? conversationId.trim() : newConversationId();
        ChatSession session = repository.findByUserIdAndConversationIdAndDeletedFalse(userId, id)
                .orElseGet(() -> {
                    ChatSession s = new ChatSession();
                    s.setUserId(userId);
                    s.setConversationId(id);
                    return s;
                });
        if (StringUtils.hasText(title)) {
            session.setTitle(title.trim());
        }
        if (StringUtils.hasText(vendor)) {
            session.setVendorCode(vendor.trim());
        }
        if (StringUtils.hasText(modelCode)) {
            session.setModelCode(modelCode.trim());
        }
        if (docIds != null) {
            session.setRagDocIds(joinDocIds(docIds));
        }
        if (compressEnabled != null) {
            session.setCompressEnabled(compressEnabled);
        }
        if (!StringUtils.hasText(session.getTitle())) {
            session.setTitle("新对话");
        }
        return toVO(repository.save(session));
    }

    /** 局部更新：null 表示不改；docIds 传空数组表示清空 RAG 范围 */
    @Transactional
    public ChatSessionVO update(Long userId, String conversationId, String title,
                                String vendor, String modelCode,
                                List<Long> docIds, Boolean compressEnabled) {
        ChatSession session = require(userId, conversationId);
        if (StringUtils.hasText(title)) {
            session.setTitle(title.trim());
        }
        if (StringUtils.hasText(vendor)) {
            session.setVendorCode(vendor.trim());
        }
        if (StringUtils.hasText(modelCode)) {
            session.setModelCode(modelCode.trim());
        }
        if (docIds != null) {
            session.setRagDocIds(joinDocIds(docIds));
        }
        if (compressEnabled != null) {
            session.setCompressEnabled(compressEnabled);
        }
        return toVO(repository.save(session));
    }

    /**
     * 发消息前解析会话配置：会话不存在则创建；会话已有模型则优先沿用，
     * 请求里带了新模型（用户在新会话里首次选择）时写回。
     */
    @Transactional
    public ChatSessionVO resolveForSend(Long userId, String conversationId, String vendor, String modelCode,
                                        List<Long> docIds, Boolean compressEnabled, String message) {
        String id = StringUtils.hasText(conversationId) ? conversationId.trim() : newConversationId();
        ChatSession session = repository.findByUserIdAndConversationIdAndDeletedFalse(userId, id)
                .orElseGet(() -> {
                    ChatSession s = new ChatSession();
                    s.setUserId(userId);
                    s.setConversationId(id);
                    s.setTitle(titleFrom(message));
                    return s;
                });
        if (StringUtils.hasText(vendor)) {
            session.setVendorCode(vendor.trim());
        }
        if (StringUtils.hasText(modelCode)) {
            session.setModelCode(modelCode.trim());
        }
        if (docIds != null) {
            session.setRagDocIds(joinDocIds(docIds));
        }
        if (compressEnabled != null) {
            session.setCompressEnabled(compressEnabled);
        }
        if (!StringUtils.hasText(session.getTitle())) {
            session.setTitle(titleFrom(message));
        }
        return toVO(repository.save(session));
    }

    public Optional<ChatSessionVO> find(Long userId, String conversationId) {
        return repository.findByUserIdAndConversationIdAndDeletedFalse(userId, conversationId).map(this::toVO);
    }

    public List<ChatSessionVO> list(Long userId) {
        return repository.findByUserIdAndDeletedFalseOrderByUpdateTimeDesc(userId).stream()
                .map(this::toVO)
                .toList();
    }

    /** 软删除会话配置；消息行由 ChatHistoryService 负责物理删除 */
    @Transactional
    public boolean delete(Long userId, String conversationId) {
        repository.findByUserIdAndConversationIdAndDeletedFalse(userId, conversationId)
                .ifPresent(s -> {
                    s.setDeleted(true);
                    repository.save(s);
                });
        return true;
    }

    private ChatSession require(Long userId, String conversationId) {
        return repository.findByUserIdAndConversationIdAndDeletedFalse(userId, conversationId)
                .orElseThrow(() -> new com.vc.common.exception.BusinessException(
                        com.vc.common.exception.ErrorCode.PARAMS_ERROR, "会话不存在"));
    }

    private ChatSessionVO toVO(ChatSession s) {
        ChatSessionVO vo = new ChatSessionVO();
        vo.setConversationId(s.getConversationId());
        vo.setTitle(s.getTitle());
        vo.setVendor(s.getVendorCode());
        vo.setModelCode(s.getModelCode());
        vo.setDocIds(parseDocIds(s.getRagDocIds()));
        vo.setCompressEnabled(Boolean.TRUE.equals(s.getCompressEnabled()));
        if (s.getCreateTime() != null) {
            vo.setCreatedAt(s.getCreateTime().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
        }
        if (s.getUpdateTime() != null) {
            vo.setUpdatedAt(s.getUpdateTime().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
        }
        return vo;
    }

    private static String joinDocIds(List<Long> docIds) {
        if (docIds == null || docIds.isEmpty()) {
            return "";
        }
        List<Long> clean = docIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        return String.join(",", clean.stream().map(String::valueOf).toList());
    }

    public static List<Long> parseDocIds(String raw) {
        if (!StringUtils.hasText(raw)) {
            return new ArrayList<>();
        }
        List<Long> result = new ArrayList<>();
        for (String part : Arrays.stream(raw.split(",")).map(String::trim).toList()) {
            if (part.isEmpty()) {
                continue;
            }
            try {
                result.add(Long.parseLong(part));
            } catch (NumberFormatException ignored) {
                // 历史脏数据跳过，不影响会话加载
            }
        }
        return result;
    }

    private static String newConversationId() {
        return "conv-" + System.currentTimeMillis() + "-"
                + ThreadLocalRandom.current().nextInt(1000, 9999);
    }

    private static String titleFrom(String message) {
        if (!StringUtils.hasText(message)) {
            return "新对话";
        }
        String flat = message.replaceAll("\\s+", " ").trim();
        return flat.length() <= TITLE_MAX ? flat : flat.substring(0, TITLE_MAX) + "…";
    }
}
