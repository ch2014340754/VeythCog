package com.vc.knowledge.clip.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 收件箱详情：列表项 + 正文（Markdown 权威 / 原始 HTML 只读/可清空）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class ClipItemDetail extends ClipItemView {

    private String contentMd;

    private String rawHtml;
}
