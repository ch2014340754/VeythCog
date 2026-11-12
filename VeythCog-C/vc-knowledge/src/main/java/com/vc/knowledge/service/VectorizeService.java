package com.vc.knowledge.service;

import com.vc.knowledge.dto.RetrieveChunk;

import java.util.List;

/**
 * 向量化 / RAG 召回服务。
 */
public interface VectorizeService {

    /** 向量化：切片 → embedding → 先删后插 → 置 is_vectorized=true，返回分片数 */
    int vectorize(Long userId, Long docId);

    /** 取消向量化：删除该文档全部 embedding，置 is_vectorized=false */
    void unvectorize(Long userId, Long docId);

    /** RAG 召回：docIds 必须同库，返回 topN 个片段 */
    List<RetrieveChunk> retrieve(Long userId, List<Long> docIds, String query, int topN);

    /**
     * 全库 RAG 召回：只搜当前账号可见、且已向量化的文档。
     * <p>用于搜索页“优先知识库”，不要求用户选择文档集合。</p>
     */
    List<RetrieveChunk> retrieveAll(Long userId, String query, int topN);

    /** 当前账号是否存在已向量化文档（搜索页知识库开关的置灰依据） */
    boolean hasVectorizedDocs(Long userId);
}
