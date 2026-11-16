package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 剪藏令牌列表项（**不含明文**，明文只在生成时返回一次）。
 */
@Data
public class ClipTokenView implements Serializable {

    private Long id;

    private String label;

    private Long createdAt;

    /** 最近一次使用时间；从未使用为 null */
    private Long lastUsedAt;

    private Boolean revoked;
}
