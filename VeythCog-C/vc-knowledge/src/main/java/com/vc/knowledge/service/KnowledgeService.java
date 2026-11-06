package com.vc.knowledge.service;

import com.vc.knowledge.dto.DocDetail;
import com.vc.knowledge.dto.DocListItem;
import com.vc.knowledge.dto.DocSaveRequest;
import com.vc.knowledge.dto.PageResult;

import java.util.List;

/**
 * 知识库文档服务：CRUD + 导入导出 + 关键词列表检索。
 * userId 为 null 表示匿名访客（仅可访问 demo 库只读）。
 */
public interface KnowledgeService {

    PageResult<DocListItem> list(Long userId, String libType, String keyword,
                                 List<String> tags, String sortField, String sortOrder,
                                 int current, int pageSize);

    DocDetail get(Long userId, Long docId);

    Long create(Long userId, DocSaveRequest req);

    void update(Long userId, Long docId, DocSaveRequest req);

    void delete(Long userId, Long docId);

    Long importMd(Long userId, String libType, String title, List<String> tags, String markdownText);

    String exportMd(Long userId, Long docId);
}
