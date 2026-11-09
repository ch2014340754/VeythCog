package com.vc.knowledge.service;

import com.vc.knowledge.dto.DocDetail;
import com.vc.knowledge.dto.DocListItem;
import com.vc.knowledge.dto.DocSaveRequest;
import com.vc.knowledge.dto.PageResult;

import java.util.List;

/**
 * 知识库文档服务：CRUD + 导入导出 + 关键词列表检索。
 */
public interface KnowledgeService {

    PageResult<DocListItem> list(Long userId, String keyword,
                                 List<String> tags, String sortField, String sortOrder,
                                 int current, int pageSize);

    DocDetail get(Long userId, Long docId);

    Long create(Long userId, DocSaveRequest req);

    void update(Long userId, Long docId, DocSaveRequest req);

    void delete(Long userId, Long docId);

    Long importMd(Long userId, String title, List<String> tags, String markdownText);

    String exportMd(Long userId, Long docId);

    /**
     * 仅更新元数据（摘要 / 标签），不影响正文与向量化状态。
     * <p>{@code null} 表示"该字段不动"，用于"仅填充空值"场景。</p>
     */
    void updateMetadata(Long userId, Long docId, String summary, List<String> tags);
}
