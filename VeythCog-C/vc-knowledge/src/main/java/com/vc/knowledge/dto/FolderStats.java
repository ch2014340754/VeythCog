package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 目录影响范围统计（删除二次确认用）：递归包含子目录与文档。
 */
@Data
public class FolderStats implements Serializable {

    /** 递归文档数（不含子目录自身） */
    private long docCount;

    /** 递归子目录数（不含当前目录） */
    private long folderCount;
}
