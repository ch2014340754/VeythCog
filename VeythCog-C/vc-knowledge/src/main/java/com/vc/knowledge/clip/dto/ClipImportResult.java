package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 剪藏项入库结果：向量化失败不影响文档已建的事实（返回 {@code vectorized=false} 让前端提示重试）。
 */
@Data
public class ClipImportResult implements Serializable {

    private Long clipId;

    private Long docId;

    private boolean vectorized;

    /** 向量化分片数；未向量化为 0 */
    private int chunkCount;

    /** 向量化失败原因 */
    private String error;

    /** true = 该条之前已经入库过（前端提示"已入库"并直接跳转，不重复建文档） */
    private boolean alreadyImported;
}
