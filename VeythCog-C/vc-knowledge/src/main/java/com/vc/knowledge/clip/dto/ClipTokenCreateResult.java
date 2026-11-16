package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 新建令牌的返回：{@code token} 明文只在此处出现一次，前端应立刻提示用户复制。
 */
@Data
public class ClipTokenCreateResult implements Serializable {

    private Long id;

    private String label;

    /** 明文令牌（只返回一次，不入库） */
    private String token;

    /** 已把令牌拼好的书签脚本（`javascript:` 链接），前端直接渲染成可拖拽书签 */
    private String bookmarklet;

    private Long createdAt;
}
