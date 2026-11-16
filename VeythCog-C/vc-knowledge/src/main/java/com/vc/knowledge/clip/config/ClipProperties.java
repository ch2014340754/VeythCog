package com.vc.knowledge.clip.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 网页剪藏配置（clip.*）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "clip")
public class ClipProperties {

    private Fetch fetch = new Fetch();

    /** 单账号收件箱条数上限（超限拒绝新剪藏） */
    private int maxItems = 1000;

    /** 单账号每日抓取次数上限 */
    private int dailyLimit = 200;

    /** 单个令牌每分钟抓取次数上限 */
    private int tokenRatePerMinute = 10;

    /** 原始 HTML 单条保留上限（字符），超出直接不落 raw_html */
    private int maxRawHtmlChars = 400_000;

    /** 生成书签脚本时使用的后端地址（前端可传 apiBase 覆盖，本地开发才能指向 localhost） */
    private String publicApiBase = "https://www.veythcog.top/api";

    @Data
    public static class Fetch {
        /** 响应体上限（字节）：2MB，超出截断 */
        private int maxBytes = 2 * 1024 * 1024;
        /** 连接超时（毫秒） */
        private int connectTimeoutMs = 4000;
        /** 整请求超时（毫秒） */
        private int timeoutMs = 8000;
        /** 最大重定向跳数（每跳都要重新做 SSRF 校验） */
        private int maxRedirects = 3;
        /** 抓取 UA：站点按此识别"这不是浏览器"，也便于对方联系 */
        private String userAgent = "VeythCogClipper/1.0 (+https://www.veythcog.top)";
        /** 正文提取失败时，整页文本兜底的最小可接受长度（字符） */
        private int minArticleChars = 200;
    }
}
