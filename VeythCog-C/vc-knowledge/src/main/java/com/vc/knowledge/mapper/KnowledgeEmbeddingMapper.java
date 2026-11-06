package com.vc.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.knowledge.entity.KnowledgeEmbedding;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 向量分片 Mapper：普通 CRUD 用 BaseMapper；pgvector 近邻检索 SQL 统一放 XML。
 */
public interface KnowledgeEmbeddingMapper extends BaseMapper<KnowledgeEmbedding> {

    /**
     * 限定 docIds 的 L2 距离近邻检索（禁止全库向量搜索）。
     * 返回片段 + 文档 ID + 标题 + chunk 索引 + 距离，供引用溯源。
     */
    List<RetrieveChunk> retrieveByDocIds(@Param("docIds") List<Long> docIds,
                                         @Param("queryVector") float[] queryVector,
                                         @Param("embeddingModel") String embeddingModel,
                                         @Param("distanceThreshold") double distanceThreshold,
                                         @Param("limit") int limit);
}
