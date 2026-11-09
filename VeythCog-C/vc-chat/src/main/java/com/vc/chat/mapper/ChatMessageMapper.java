package com.vc.chat.mapper;

import com.vc.chat.dto.ChatConversationRow;
import com.vc.chat.dto.ChatMessageInsert;
import com.vc.chat.dto.ChatMessageRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 对话记忆表 {@code chat_message} 的数据访问。
 * <p>SQL 全部收敛在 {@code resources/mapper/ChatMessageMapper.xml}，
 * 供 Spring AI 的 ChatMemoryRepository 与对外会话历史接口共用。</p>
 */
@Mapper
public interface ChatMessageMapper {

    /** 会话聚合（前缀匹配 {@code userId:}），按最近活动倒序 */
    List<ChatConversationRow> selectConversations(@Param("prefix") String prefix);

    /** 某会话全部消息（按 seq 升序，含 system） */
    List<ChatMessageRow> selectMessages(@Param("conversationId") String conversationId);

    /** 全库会话主键（ChatMemoryRepository.findConversationIds 所需） */
    List<String> selectConversationIds();

    int deleteByConversationId(@Param("conversationId") String conversationId);

    /** 批量写入，seq 取 foreach 下标 */
    int insertBatch(@Param("conversationId") String conversationId,
                    @Param("messages") List<ChatMessageInsert> messages);
}
