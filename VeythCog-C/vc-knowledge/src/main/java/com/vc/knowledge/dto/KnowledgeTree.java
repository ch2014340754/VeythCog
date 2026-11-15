package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 知识树查询结果：目录与文档均为扁平数组，层级由前端按 parentId / folderId 组装。
 */
@Data
public class KnowledgeTree implements Serializable {

    private List<FolderNode> folders;

    private List<DocNode> docs;

    /** 返回的文档总数（关键词为空时等于全库文档数） */
    private long total;

    /** 关键词命中数；关键词为空时等于 total */
    private long matchedCount;
}
