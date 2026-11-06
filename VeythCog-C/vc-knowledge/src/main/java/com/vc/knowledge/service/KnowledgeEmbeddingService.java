package com.vc.knowledge.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.vc.knowledge.entity.KnowledgeEmbedding;

/**
 * 向量分片数据服务（继承 MyBatis-Plus IService，提供 saveBatch/remove 等批量能力）。
 */
public interface KnowledgeEmbeddingService extends IService<KnowledgeEmbedding> {
}
