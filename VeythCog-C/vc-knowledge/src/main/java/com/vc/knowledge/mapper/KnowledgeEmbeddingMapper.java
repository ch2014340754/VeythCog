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
     * <p>{@code distanceThreshold} 传 null 表示不做距离过滤，仅按距离取 topN——
     * 用于阈值无命中时的兜底，避免"选了文档却一条都召不回"。</p>
     */
    List<RetrieveChunk> retrieveByDocIds(@Param("docIds") List<Long> docIds,
                                         @Param("queryVector") float[] queryVector,
                                         @Param("embeddingModel") String embeddingModel,
                                         @Param("distanceThreshold") Double distanceThreshold,
                                         @Param("limit") int limit);

    /**
     * 全库已向量化文档的 L2 近邻检索（仅用于搜索页“优先知识库”）。
     * <p>范围是 {@code knowledge_doc.deleted=false AND is_vectorized=true}，不接受单文档过滤；
     * 距离阈值传 null 时只按距离取 topN。</p>
     */
    List<RetrieveChunk> retrieveAll(@Param("queryVector") float[] queryVector,
                                    @Param("embeddingModel") String embeddingModel,
                                    @Param("distanceThreshold") Double distanceThreshold,
                                    @Param("limit") int limit);
}
