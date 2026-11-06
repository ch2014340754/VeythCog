package com.vc.knowledge.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.vc.knowledge.entity.KnowledgeEmbedding;
import com.vc.knowledge.mapper.KnowledgeEmbeddingMapper;
import com.vc.knowledge.service.KnowledgeEmbeddingService;
import org.springframework.stereotype.Service;

/**
 * 向量分片数据服务实现。
 */
@Service
public class KnowledgeEmbeddingServiceImpl
        extends ServiceImpl<KnowledgeEmbeddingMapper, KnowledgeEmbedding>
        implements KnowledgeEmbeddingService {
}
