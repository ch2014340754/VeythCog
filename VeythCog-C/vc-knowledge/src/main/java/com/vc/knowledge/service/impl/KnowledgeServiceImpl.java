package com.vc.knowledge.service.impl;

import com.vc.knowledge.entity.KnowledgeBase;
import com.vc.knowledge.service.KnowledgeService;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * 知识库服务骨架实现
 * <p>Phase 2 演进：文档上传 → 解析 → 分块 → Embedding → pgvector 检索 → 带引用回答。</p>
 */
@Service
public class KnowledgeServiceImpl implements KnowledgeService {

    @Override
    public List<KnowledgeBase> listKnowledgeBases() {
        // TODO(Phase 2): 查询知识库表
        return Collections.emptyList();
    }

    @Override
    public Long createKnowledgeBase(String name, String description) {
        // TODO(Phase 2): 落库
        return 1L;
    }
}
