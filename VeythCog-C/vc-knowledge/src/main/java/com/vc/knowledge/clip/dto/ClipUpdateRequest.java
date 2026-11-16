package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 更新收件箱条目：标题 / 标签 / 正文（手工修正抓取结果）/ 状态 / 清空原始 HTML。
 *
 * <p>字段为 {@code null} 表示"不改动"（前端只提交它真正改过的项）。</p>
 */
@Data
public class ClipUpdateRequest implements Serializable {

    private String title;

    private List<String> tags;

    /** 手工修正后的 Markdown；提交后会重算字数与摘要 */
    private String contentMd;

    /** pending / dropped / archived（archived 只能由入库接口产生，这里不接收） */
    private String status;

    /** true = 丢弃时顺手清掉原始 HTML，释放空间 */
    private Boolean clearRawHtml;
}
