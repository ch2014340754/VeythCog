package com.vc.knowledge.service;

import com.vc.knowledge.entity.KnowledgeBase;

import java.util.List;

/**
 * 知识库服务
 */
public interface KnowledgeService {

    /**
     * 知识库列表
     */
    List<KnowledgeBase> listKnowledgeBases();

    /**
     * 创建知识库，返回 id
     */
    Long createKnowledgeBase(String name, String description);
}
