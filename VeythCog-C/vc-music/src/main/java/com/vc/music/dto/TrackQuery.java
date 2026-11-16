package com.vc.music.dto;

import lombok.Data;

/**
 * 曲库列表查询参数。
 */
@Data
public class TrackQuery {

    /** 标题 / 艺人关键词 */
    private String keyword;

    /** 来源过滤：UPLOAD / AI_GEN / JAMENDO / AIGEI_CC / AI_OTHER */
    private String source;

    /** 只看背景音池 */
    private boolean ambientOnly;

    /** 标签过滤 */
    private String tag;

    private int current = 1;

    private int pageSize = 20;

    private String sortField;

    private String sortOrder = "descend";
}
