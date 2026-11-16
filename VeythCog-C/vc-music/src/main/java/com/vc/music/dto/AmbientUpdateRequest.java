package com.vc.music.dto;

import lombok.Data;

/**
 * 背景音池启停 + 排序请求。
 */
@Data
public class AmbientUpdateRequest {

    /** 是否进背景音池（必填语义：为 null 视为 false） */
    private Boolean enabled;

    /** 池内排序值，null 表示排到末尾（max + 10） */
    private Integer order;
}
