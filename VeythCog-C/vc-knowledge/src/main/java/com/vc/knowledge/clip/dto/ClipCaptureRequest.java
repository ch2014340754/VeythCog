package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 书签脚本 / 扩展上报的剪藏请求（{@code POST /clip/capture}，Content-Type: text/plain）。
 *
 * <p>用纯文本包 JSON 是为了避开 CORS 预检请求：简单请求不受目标站点与本站的
 * 来源差异影响，脚本代码最短、最不容易被拦。</p>
 */
@Data
public class ClipCaptureRequest implements Serializable {

    /** 来源页面 URL（可选，但强烈建议带上，用于去重与回链） */
    private String url;

    /** 页面标题；为空时从 html 的 <title> 兜底 */
    private String title;

    /** 页面 HTML（readability 用）；可在页面侧只取正文容器以减小体积 */
    private String html;

    /** 页面侧截取的正文片段（html 缺失时作为兜底） */
    private String excerpt;

    /** 若用户只剪了选区，这里带选中的纯文本（P2 仅入库正文，不强依赖） */
    private String selection;
}
