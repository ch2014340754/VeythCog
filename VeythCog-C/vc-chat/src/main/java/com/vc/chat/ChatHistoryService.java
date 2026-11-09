package com.vc.chat;

import com.vc.chat.dto.ChatConversationRow;
import com.vc.chat.dto.ChatConversationVO;
import com.vc.chat.dto.ChatMessageRow;
import com.vc.chat.dto.ChatMessageVO;
import com.vc.chat.mapper.ChatMessageMapper;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.List;

/**
 * 会话历史查询服务：把 Spring AI 的对话记忆表 {@code chat_message} 反查成"会话列表 + 消息列表"。
 *
 * <p>SQL 位于 {@code resources/mapper/ChatMessageMapper.xml}；本类只负责展示层加工
 * （剥离 {@code userId:} 前缀、还原被 RAG 增强 prompt 包裹的用户问题、截断标题）。</p>
 *
 * <p>注意：写入侧是 {@code MessageWindowChatMemory} 的全量覆盖（窗口 20 条），
 * 因此超长会话的早期消息会被窗口裁掉——本服务只能回显库中现存的部分。</p>
 */
@Service
public class ChatHistoryService {

    private static final int TITLE_MAX = 30;
    private static final int LAST_MAX = 80;

    /** RAG 增强 prompt 的开头与问题分隔符（见 RagChatOrchestrator#buildAugmentedMessage） */
    private static final String RAG_PROMPT_HEAD = "以下是用户知识库中检索到的参考资料";
    private static final String RAG_QUESTION_MARK = "用户问题：";

    private final ChatMessageMapper chatMessageMapper;

    public ChatHistoryService(ChatMessageMapper chatMessageMapper) {
        this.chatMessageMapper = chatMessageMapper;
    }

    /** 当前账号的会话列表（按最近活动倒序） */
    public List<ChatConversationVO> listConversations(Long userId) {
        String prefix = userId + ":";
        List<ChatConversationRow> rows = chatMessageMapper.selectConversations(prefix + "%");
        return rows.stream().map(row -> {
            ChatConversationVO vo = new ChatConversationVO();
            String fullId = row.getConversationId();
            vo.setId(fullId != null && fullId.startsWith(prefix)
                    ? fullId.substring(prefix.length()) : fullId);
            vo.setTitle(displayText(row.getFirstUser(), TITLE_MAX, "新对话"));
            vo.setLastMessage(displayText(row.getLastContent(), LAST_MAX, ""));
            vo.setMessageCount(row.getMessageCount());
            vo.setCreatedAt(toMillis(row.getCreatedAt()));
            vo.setUpdatedAt(toMillis(row.getUpdatedAt()));
            return vo;
        }).toList();
    }

    /** 某会话的消息列表（按 seq 升序，system 消息不下发） */
    public List<ChatMessageVO> listMessages(Long userId, String conversationId) {
        String key = userId + ":" + conversationId;
        List<ChatMessageRow> rows = chatMessageMapper.selectMessages(key);
        return rows.stream()
                .filter(row -> row.getRole() != null && !"system".equals(row.getRole()))
                .map(row -> {
                    ChatMessageVO vo = new ChatMessageVO();
                    vo.setId(row.getId());
                    vo.setRole(row.getRole());
                    vo.setContent(stripRagContext(row.getContent()));
                    vo.setCreatedAt(toMillis(row.getCreatedAt()));
                    return vo;
                })
                .toList();
    }

    /** 删除会话（物理删除该会话的记忆行；会话不存在时为无害空操作） */
    public boolean deleteConversation(Long userId, String conversationId) {
        chatMessageMapper.deleteByConversationId(userId + ":" + conversationId);
        return true;
    }

    private static Long toMillis(Timestamp ts) {
        return ts == null ? null : ts.getTime();
    }

    /**
     * 还原用户原始问题：RAG 增强时落库的是"资料上下文 + 用户问题"的整段 prompt，
     * 展示与标题必须剥离上下文，否则气泡里全是文档片段。
     */
    private static String stripRagContext(String content) {
        if (content == null) return null;
        if (!content.startsWith(RAG_PROMPT_HEAD)) return content;
        int idx = content.lastIndexOf(RAG_QUESTION_MARK);
        return idx >= 0 ? content.substring(idx + RAG_QUESTION_MARK.length()).trim() : content;
    }

    /** 单行摘要（用于标题 / 列表最后一条） */
    private static String displayText(String content, int max, String fallback) {
        String raw = stripRagContext(content);
        if (raw == null || raw.isBlank()) return fallback;
        String flat = raw.replaceAll("\\s+", " ").trim();
        return flat.length() <= max ? flat : flat.substring(0, max) + "…";
    }
}
