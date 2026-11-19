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

    /**
     * 移动文档归属目录；folderId 为空表示移到根级。
     * <p>只改归属，不置 {@code isVectorized=false}、不动 updatedAt。</p>
     */
    void moveDoc(Long userId, Long docId, Long folderId);

    /**
     * 最近更新的文档（首页工作台用）；只返回轻量字段。
     */
    List<DocListItem> recentDocs(int limit);

    /**
     * 待向量化文档数：未删除、is_vectorized=false 且正文长度 >= minChars。
     * <p>阈值过滤掉过短的空白文档，避免首页提示长期挂着一个不值的数字。</p>
     */
    long countPendingVector(int minChars);

    /**
     * 仅重命名文档标题：不动正文 / 摘要 / 标签，**不置** {@code isVectorized=false}。
     */
    void renameTitle(Long userId, Long docId, String title);
}
