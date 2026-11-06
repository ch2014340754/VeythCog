package com.vc.knowledge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.dto.DocDetail;
import com.vc.knowledge.dto.DocListItem;
import com.vc.knowledge.dto.DocSaveRequest;
import com.vc.knowledge.dto.PageResult;
import com.vc.knowledge.entity.KnowledgeDoc;
import com.vc.knowledge.entity.KnowledgeEmbedding;
import com.vc.knowledge.mapper.KnowledgeDocMapper;
import com.vc.knowledge.service.KnowledgeEmbeddingService;
import com.vc.knowledge.service.KnowledgeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 知识库文档服务实现（MyBatis-Plus）。
 * <p>普通 CRUD/分页/过滤/软删除用 MP BaseMapper + LambdaWrapper；
 * 关键词全文检索与 tags 数组过滤（PG 特有语法）收拢到 KnowledgeDocMapper.xml。</p>
 */
@Service
public class KnowledgeServiceImpl implements KnowledgeService {

    private static final int SUMMARY_LENGTH = 200;

    private final KnowledgeDocMapper docMapper;
    private final KnowledgeEmbeddingService embeddingService;
    private final ObjectMapper objectMapper;

    public KnowledgeServiceImpl(KnowledgeDocMapper docMapper,
                                KnowledgeEmbeddingService embeddingService,
                                ObjectMapper objectMapper) {
        this.docMapper = docMapper;
        this.embeddingService = embeddingService;
        this.objectMapper = objectMapper;
    }

    @Override
    public PageResult<DocListItem> list(Long userId, String libType, String keyword,
                                        List<String> tags, String sortField, String sortOrder,
                                        int current, int pageSize) {
        checkLibType(libType);
        checkPrivateAccess(userId, libType);

        int safePageSize = pageSize <= 0 ? 10 : pageSize;
        int safeCurrent = Math.max(1, current);
        String tag = tags != null && !tags.isEmpty() ? tags.get(0) : null;

        IPage<KnowledgeDoc> page = docMapper.selectDocList(
                new Page<>(safeCurrent, safePageSize), libType, keyword, tag, sortField, sortOrder);

        List<DocListItem> records = page.getRecords().stream().map(this::toListItem).toList();
        return new PageResult<>(records, page.getTotal(), safeCurrent, safePageSize);
    }

    @Override
    public DocDetail get(Long userId, Long docId) {
        KnowledgeDoc doc = requireDoc(docId);
        checkPrivateAccess(userId, doc.getLibType());
        return toDetail(doc);
    }

    @Override
    @Transactional
    public Long create(Long userId, DocSaveRequest req) {
        checkLibType(req.getLibType());
        checkPrivateAccess(userId, req.getLibType());
        checkDemoReadOnly(req.getLibType());

        KnowledgeDoc doc = new KnowledgeDoc();
        doc.setLibType(req.getLibType());
        doc.setTitle(req.getTitle());
        doc.setSummary(emptyIfNull(req.getSummary()));
        doc.setTags(toArray(req.getTags()));
        doc.setBlockData(emptyIfNull(req.getBlockData(), "[]"));
        doc.setMarkdownText(emptyIfNull(req.getMarkdownText()));
        doc.setIsVectorized(false);
        doc.setUpdatedAt(LocalDateTime.now());
        docMapper.insert(doc);
        return doc.getId();
    }

    @Override
    @Transactional
    public void update(Long userId, Long docId, DocSaveRequest req) {
        KnowledgeDoc doc = requireDoc(docId);
        checkPrivateAccess(userId, doc.getLibType());
        checkDemoReadOnly(doc.getLibType());

        doc.setTitle(req.getTitle());
        doc.setSummary(emptyIfNull(req.getSummary()));
        doc.setTags(toArray(req.getTags()));
        doc.setBlockData(emptyIfNull(req.getBlockData(), "[]"));
        doc.setMarkdownText(emptyIfNull(req.getMarkdownText()));
        // 内容已变更，向量索引失效，需重新向量化
        doc.setIsVectorized(false);
        doc.setUpdatedAt(LocalDateTime.now());
        docMapper.updateById(doc);
    }

    @Override
    @Transactional
    public void delete(Long userId, Long docId) {
        KnowledgeDoc doc = requireDoc(docId);
        checkPrivateAccess(userId, doc.getLibType());
        checkDemoReadOnly(doc.getLibType());

        // 软删除（@TableLogic 自动置 deleted=true）
        docMapper.deleteById(docId);
        // 软删除不触发 FK 级联，显式清理 embedding
        embeddingService.remove(new LambdaQueryWrapper<KnowledgeEmbedding>()
                .eq(KnowledgeEmbedding::getDocId, docId));
    }

    @Override
    @Transactional
    public Long importMd(Long userId, String libType, String title, List<String> tags, String markdownText) {
        checkLibType(libType);
        checkPrivateAccess(userId, libType);
        checkDemoReadOnly(libType);

        String md = emptyIfNull(markdownText);
        KnowledgeDoc doc = new KnowledgeDoc();
        doc.setLibType(libType);
        doc.setTitle(title == null || title.isBlank() ? "未命名文档" : title.trim());
        doc.setSummary(summaryOf(md));
        doc.setTags(toArray(tags));
        doc.setBlockData(markdownToBlocks(md));
        doc.setMarkdownText(md);
        doc.setIsVectorized(false);
        doc.setUpdatedAt(LocalDateTime.now());
        docMapper.insert(doc);
        return doc.getId();
    }

    @Override
    public String exportMd(Long userId, Long docId) {
        KnowledgeDoc doc = requireDoc(docId);
        checkPrivateAccess(userId, doc.getLibType());
        return doc.getMarkdownText();
    }

    // ---------------- 私有辅助 ----------------

    private KnowledgeDoc requireDoc(Long docId) {
        KnowledgeDoc doc = docMapper.selectById(docId);
        if (doc == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "文档不存在");
        }
        return doc;
    }

    private void checkLibType(String libType) {
        if (!"private".equals(libType) && !"demo".equals(libType)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "libType 非法（仅 private / demo）");
        }
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

    private String[] toArray(List<String> list) {
        return list == null ? new String[0] : list.toArray(new String[0]);
    }

    private Long toEpochMilli(LocalDateTime dt) {
        return dt == null ? null : dt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private String emptyIfNull(String v) {
        return v == null ? "" : v;
    }

    private String emptyIfNull(String v, String def) {
        return v == null || v.isBlank() ? def : v;
    }

    private String summaryOf(String md) {
        String plain = md == null ? "" : md.replaceAll("\\s+", " ").trim();
        return plain.length() <= SUMMARY_LENGTH ? plain : plain.substring(0, SUMMARY_LENGTH);
    }

    private DocListItem toListItem(KnowledgeDoc doc) {
        DocListItem item = new DocListItem();
        item.setId(doc.getId());
        item.setTitle(doc.getTitle());
        item.setSummary(doc.getSummary());
        item.setTags(doc.getTags() == null ? List.of() : Arrays.asList(doc.getTags()));
        item.setLibType(doc.getLibType());
        item.setIsVectorized(doc.getIsVectorized());
        item.setUpdatedAt(toEpochMilli(doc.getUpdatedAt()));
        return item;
    }

    private DocDetail toDetail(KnowledgeDoc doc) {
        DocDetail d = new DocDetail();
        d.setId(doc.getId());
        d.setLibType(doc.getLibType());
        d.setTitle(doc.getTitle());
        d.setSummary(doc.getSummary());
        d.setTags(doc.getTags() == null ? List.of() : Arrays.asList(doc.getTags()));
        d.setBlockData(doc.getBlockData());
        d.setMarkdownText(doc.getMarkdownText());
        d.setIsVectorized(doc.getIsVectorized());
        d.setCreatedAt(toEpochMilli(doc.getCreatedAt()));
        d.setUpdatedAt(toEpochMilli(doc.getUpdatedAt()));
        return d;
    }

    /** 简化 md → block 结构：按空行分段，标题行识别为 heading（P0 够用，前端 BlockNote 后续对齐）。 */
    private String markdownToBlocks(String md) {
        List<Map<String, Object>> blocks = new ArrayList<>();
        String[] paragraphs = md.split("\\n\\s*\\n");
        for (String p : paragraphs) {
            String trimmed = p.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("id", UUID.randomUUID().toString());
            if (trimmed.startsWith("### ")) {
                b.put("type", "heading");
                b.put("level", 3);
                b.put("content", trimmed.substring(4));
            } else if (trimmed.startsWith("## ")) {
                b.put("type", "heading");
                b.put("level", 2);
                b.put("content", trimmed.substring(3));
            } else if (trimmed.startsWith("# ")) {
                b.put("type", "heading");
                b.put("level", 1);
                b.put("content", trimmed.substring(2));
            } else {
                b.put("type", "paragraph");
                b.put("content", p);
            }
            blocks.add(b);
        }
        try {
            return objectMapper.writeValueAsString(blocks);
        } catch (Exception e) {
            return "[]";
        }
    }
}
