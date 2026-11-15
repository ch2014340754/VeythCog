package com.vc.knowledge.service;

import com.vc.knowledge.dto.FolderStats;
import com.vc.knowledge.dto.KnowledgeTree;

/**
 * 知识库目录服务：树查询 + 目录增删改移 + 影响范围统计。
 */
public interface KnowledgeFolderService {

    /**
     * 知识树：目录与文档扁平返回，层级由前端组装；关键词非空时只返回命中文档及其祖先目录。
     */
    KnowledgeTree tree(String keyword);

    /** 新建目录；parentId 为空表示根级。返回新目录 id。 */
    Long create(Long parentId, String rawName);

    /** 重命名目录。 */
    void rename(Long folderId, String rawName);

    /** 删除目录：非空且 recursive=false 时报错；recursive=true 时递归软删子目录与文档并清理向量。 */
    void delete(Long folderId, boolean recursive);

    /** 递归统计目录下的文档数与子目录数（删除二次确认用）。 */
    FolderStats stats(Long folderId);

    /** 移动目录；targetParentId 为空表示移到根级。 */
    void move(Long folderId, Long targetParentId);

    /** 校验目录存在且未删除，不存在抛 NOT_FOUND。供文档保存/移动复用。 */
    void requireFolder(Long folderId);

    /**
     * 批量导出：把目录（含全部子目录）、指定文档集合或全库文档打成 zip。
     * <p>优先按 {@code docIds}（前端勾选的文档）；未给则按 {@code folderId} 的子树；
     * 两者都为空 = 导出全部未删文档（含根级）。文档按「目录路径/标题.md」组织，重名自动追加序号。</p>
     */
    byte[] exportZip(Long folderId, java.util.List<Long> docIds);
}
