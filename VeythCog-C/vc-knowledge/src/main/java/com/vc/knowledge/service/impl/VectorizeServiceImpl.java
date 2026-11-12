package com.vc.knowledge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.config.KnowledgeProperties;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.knowledge.embedding.EmbeddingProvider;
import com.vc.knowledge.entity.KnowledgeDoc;
import com.vc.knowledge.entity.KnowledgeEmbedding;
import com.vc.knowledge.mapper.KnowledgeDocMapper;
import com.vc.knowledge.mapper.KnowledgeEmbeddingMapper;
import com.vc.knowledge.service.KnowledgeEmbeddingService;
import com.vc.knowledge.service.VectorizeService;
import com.vc.knowledge.splitter.RecursiveCharacterTextSplitter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 向量化 / RAG 召回实现（MyBatis-Plus + pgvector）。
 * <p>切片用自定义 RecursiveCharacterTextSplitter；Embedding 走 EmbeddingProvider 抽象；
 * 检索 SQL 限定 docIds + embedding_model + L2 距离阈值 + 软删除，统一放 Mapper XML。</p>
 */
@Service
public class VectorizeServiceImpl implements VectorizeService {

    private static final Logger log = LoggerFactory.getLogger(VectorizeServiceImpl.class);

    private static final int MAX_TOP_N = 50;

    private final KnowledgeDocMapper docMapper;
    private final KnowledgeEmbeddingMapper embeddingMapper;
    private final KnowledgeEmbeddingService embeddingService;
    private final EmbeddingProvider embeddingProvider;
    private final KnowledgeProperties properties;
    private final RecursiveCharacterTextSplitter splitter;

    public VectorizeServiceImpl(KnowledgeDocMapper docMapper,
                                KnowledgeEmbeddingMapper embeddingMapper,
                                KnowledgeEmbeddingService embeddingService,
                                EmbeddingProvider embeddingProvider,
                                KnowledgeProperties properties) {
        this.docMapper = docMapper;
        this.embeddingMapper = embeddingMapper;
        this.embeddingService = embeddingService;
        this.embeddingProvider = embeddingProvider;
        this.properties = properties;
        this.splitter = new RecursiveCharacterTextSplitter(
                properties.getChunk().getSize(), properties.getChunk().getOverlap());
    }

    @Override
    @Transactional
    public int vectorize(Long userId, Long docId) {
        KnowledgeDoc doc = requireDoc(docId);

        String md = doc.getMarkdownText();
        if (md == null || md.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文档内容为空，无法向量化");
        }
        List<String> chunks = splitter.split(md);
        if (chunks.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "切片结果为空，无法向量化");
        }
        List<float[]> vectors = embeddingProvider.embedBatch(chunks);
        if (vectors.size() != chunks.size()) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "向量数量与切片数量不一致");
        }

        // 幂等：先删该 doc 全部旧 embedding，再批量写入新切片（事务内）
        embeddingService.remove(new LambdaQueryWrapper<KnowledgeEmbedding>()
                .eq(KnowledgeEmbedding::getDocId, docId));

        String modelId = embeddingProvider.modelId();
        List<KnowledgeEmbedding> rows = new ArrayList<>(chunks.size());
        for (int i = 0; i < chunks.size(); i++) {
            KnowledgeEmbedding e = new KnowledgeEmbedding();
            e.setDocId(docId);
            e.setChunkIndex(i);
            e.setChunkText(chunks.get(i));
            e.setEmbedding(vectors.get(i));
            e.setEmbeddingModel(modelId);
            rows.add(e);
        }
        embeddingService.saveBatch(rows);

        doc.setIsVectorized(true);
        doc.setUpdatedAt(OffsetDateTime.now());
        docMapper.updateById(doc);
        return chunks.size();
    }

    @Override
    @Transactional
    public void unvectorize(Long userId, Long docId) {
        KnowledgeDoc doc = requireDoc(docId);

        embeddingService.remove(new LambdaQueryWrapper<KnowledgeEmbedding>()
                .eq(KnowledgeEmbedding::getDocId, docId));
        doc.setIsVectorized(false);
        doc.setUpdatedAt(OffsetDateTime.now());
        docMapper.updateById(doc);
    }

    @Override
    public List<RetrieveChunk> retrieve(Long userId, List<Long> docIds, String query, int topN) {
        List<KnowledgeDoc> docs = selectDocs(docIds);
        if (docs.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "文档不存在");
        }

        List<Long> validIds = docs.stream().map(KnowledgeDoc::getId).toList();
        int limit = Math.max(1, Math.min(topN <= 0 ? properties.getRetrieve().getTopN() : topN, MAX_TOP_N));

        float[] queryVector = embeddingProvider.embed(query);
        String modelId = embeddingProvider.modelId();
        double threshold = properties.getRetrieve().getDistanceThreshold();

        List<RetrieveChunk> chunks =
                embeddingMapper.retrieveByDocIds(validIds, queryVector, modelId, threshold, limit);
        if (!chunks.isEmpty()) {
            return chunks;
        }

        // 阈值无命中兜底：仍在选中 docIds 范围内取最近的 topN。
        // Qwen embedding 已归一化，L2 距离范围 [0,2]，不同文档间普遍在 0.5~1.0，
        // 阈值配得偏紧时会"一条都召不回"，用户表现为"答案不来自选中文档"。
        List<RetrieveChunk> fallback =
                embeddingMapper.retrieveByDocIds(validIds, queryVector, modelId, null, limit);
        if (!fallback.isEmpty()) {
            log.warn("RAG 阈值无命中，已回退 topN（未过滤距离）: 阈值={}, 回退条数={}, 最近距离={}",
                    threshold, fallback.size(), fallback.get(0).getScore());
        }
        return fallback;
    }

    @Override
    public List<RetrieveChunk> retrieveAll(Long userId, String query, int topN) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        int limit = Math.max(1, Math.min(topN <= 0 ? properties.getRetrieve().getTopN() : topN, MAX_TOP_N));
        float[] queryVector = embeddingProvider.embed(query);
        String modelId = embeddingProvider.modelId();
        double threshold = properties.getRetrieve().getDistanceThreshold();

        List<RetrieveChunk> chunks = embeddingMapper.retrieveAll(queryVector, modelId, threshold, limit);
        if (!chunks.isEmpty()) {
            return chunks;
        }
        List<RetrieveChunk> fallback = embeddingMapper.retrieveAll(queryVector, modelId, null, limit);
        if (!fallback.isEmpty()) {
            log.warn("全库 RAG 阈值无命中，已回退 topN（未过滤距离）: 阈值={}, 回退条数={}, 最近距离={}",
                    threshold, fallback.size(), fallback.get(0).getScore());
        }
        return fallback;
    }

    @Override
    public boolean hasVectorizedDocs(Long userId) {
        return docMapper.selectCount(new LambdaQueryWrapper<KnowledgeDoc>()
                .eq(KnowledgeDoc::getIsVectorized, true)) > 0;
    }

    // ---------------- 私有辅助 ----------------

    private KnowledgeDoc requireDoc(Long docId) {
        KnowledgeDoc doc = docMapper.selectById(docId);
        if (doc == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "文档不存在");
        }
        return doc;
    }

    private List<KnowledgeDoc> selectDocs(List<Long> docIds) {
        if (docIds == null || docIds.isEmpty()) {
            return List.of();
        }
        return docMapper.selectBatchIds(docIds);
    }

}
