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
}
