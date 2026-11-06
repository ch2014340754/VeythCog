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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 向量化 / RAG 召回实现（MyBatis-Plus + pgvector）。
 * <p>切片用自定义 RecursiveCharacterTextSplitter；Embedding 走 EmbeddingProvider 抽象；
 * 检索 SQL 限定 docIds + embedding_model + L2 距离阈值 + 软删除，统一放 Mapper XML。</p>
 */
@Service
public class VectorizeServiceImpl implements VectorizeService {

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
        checkPrivateAccess(userId, doc.getLibType());
        checkDemoReadOnly(doc.getLibType());

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
        doc.setUpdatedAt(LocalDateTime.now());
        docMapper.updateById(doc);
        return chunks.size();
    }

    @Override
    @Transactional
    public void unvectorize(Long userId, Long docId) {
        KnowledgeDoc doc = requireDoc(docId);
        checkPrivateAccess(userId, doc.getLibType());
        checkDemoReadOnly(doc.getLibType());

        embeddingService.remove(new LambdaQueryWrapper<KnowledgeEmbedding>()
                .eq(KnowledgeEmbedding::getDocId, docId));
        doc.setIsVectorized(false);
        doc.setUpdatedAt(LocalDateTime.now());
        docMapper.updateById(doc);
    }

    @Override
    public List<RetrieveChunk> retrieve(Long userId, List<Long> docIds, String query, int topN) {
        List<KnowledgeDoc> docs = selectDocs(docIds);
        if (docs.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "文档不存在");
        }
        // 强制同库，禁止跨库混合召回
        Set<String> libTypes = docs.stream().map(KnowledgeDoc::getLibType).collect(Collectors.toSet());
        if (libTypes.size() > 1) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不能跨库混合召回");
        }
        String libType = libTypes.iterator().next();
        checkPrivateAccess(userId, libType);

        List<Long> validIds = docs.stream().map(KnowledgeDoc::getId).toList();
        int limit = Math.max(1, Math.min(topN <= 0 ? properties.getRetrieve().getTopN() : topN, MAX_TOP_N));

        float[] queryVector = embeddingProvider.embed(query);
        String modelId = embeddingProvider.modelId();
        double threshold = properties.getRetrieve().getDistanceThreshold();

        return embeddingMapper.retrieveByDocIds(validIds, queryVector, modelId, threshold, limit);
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

    private void checkPrivateAccess(Long userId, String libType) {
        if ("private".equals(libType) && userId == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
    }

    private void checkDemoReadOnly(String libType) {
        if ("demo".equals(libType)) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR, "演示库文档禁止编辑");
        }
    }
}
