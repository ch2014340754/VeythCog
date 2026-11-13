package com.vc.chat.repository;

import com.vc.chat.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {

    Optional<ChatSession> findByUserIdAndConversationIdAndDeletedFalse(Long userId, String conversationId);

    List<ChatSession> findByUserIdAndDeletedFalseOrderByUpdateTimeDesc(Long userId);
}
