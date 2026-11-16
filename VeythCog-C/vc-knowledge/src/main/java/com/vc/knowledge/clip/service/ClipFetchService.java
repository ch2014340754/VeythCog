package com.vc.knowledge.clip.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.clip.config.ClipProperties;
import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter;
import net.dankito.readability4j.Article;
import net.dankito.readability4j.Readability4J;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

/**
 * 网页抓取与正文清洗。
 *
 * <p>三步：安全校验（防 SSRF）→ 正文提取（readability4j）→ 转 Markdown（flexmark）。
 * 提取不到正文时降级为"整页可读文本"，并把质量标记为 {@code fallback}，
 * 宁可粗糙也不丢内容。</p>
 */
@Service
public class ClipFetchService {

    private static final Logger log = LoggerFactory.getLogger(ClipFetchService.class);

    /** 只接受这几个端口，避免把抓取当端口扫描器用 */
    private static final List<Integer> ALLOWED_PORTS = List.of(80, 443, 8080, 8443);

    /** 提取正文时先去掉的噪音区块 */
    private static final String NOISE_SELECTOR =
            "script, style, noscript, iframe, form, svg, canvas, header, footer, nav, aside, .comment, .comments";

    private static final FlexmarkHtmlConverter HTML_TO_MD =
            FlexmarkHtmlConverter.builder().build();

    private final ClipProperties properties;
    private final HttpClient httpClient;

    public ClipFetchService(ClipProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(properties.getFetch().getConnectTimeoutMs()))
                // 重定向必须自己走：每一跳都要重新做 SSRF 校验，交给 HttpClient 自动跟随就校验不到
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /**
     * 抓取并清洗一个 URL。
     *
     * @throws BusinessException 参数非法（40000）或抓取失败（50001）
     */
    public Fetched fetch(String rawUrl) {
        URI uri = parseAndValidate(rawUrl);
        try {
            HttpResult result = get(uri, 0);
            return extract(result.uri().toString(), result.body(), null, null);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("剪藏抓取失败: url={}, reason={}", rawUrl, e.toString());
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "抓取失败：" + shortReason(e));
        }
    }

    /**
     * 书签脚本 / 扩展上报：直接用页面 DOM 清洗，不发任何外网请求。
     */
    public Fetched fromHtml(String url, String html, String fallbackTitle, String fallbackExcerpt) {
        String safeUrl = url == null ? "" : url.trim();
        if (html != null && !html.isBlank()) {
            return extract(safeUrl, html, fallbackTitle, fallbackExcerpt);
        }
        if (fallbackExcerpt == null || fallbackExcerpt.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上报内容为空（html 与 excerpt 至少要有一个）");
        }
        String text = fallbackExcerpt.trim();
        String title = fallbackTitle == null || fallbackTitle.isBlank() ? firstLine(text) : fallbackTitle.trim();
        return new Fetched(title, "", siteOf(safeUrl), escapeAsMarkdown(text), null,
                excerptOf(text), countWords(text), "fallback", "");
    }

    // ------------------------------------------------------------------ 抓取

    private record HttpResult(URI uri, String body) {
    }

    private HttpResult get(URI uri, int depth) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofMillis(properties.getFetch().getTimeoutMs()))
                .header("User-Agent", properties.getFetch().getUserAgent())
                .header("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                .GET()
                .build();

        HttpResponse<InputStream> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

        int status = response.statusCode();
        if (status >= 300 && status < 400) {
            String location = response.headers().firstValue("location").orElse("");
            if (depth >= properties.getFetch().getMaxRedirects()) {
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "重定向次数过多（>" 
                        + properties.getFetch().getMaxRedirects() + "）");
            }
            if (location.isBlank()) {
                throw new BusinessException(ErrorCode.OPERATION_ERROR, "站点返回重定向但缺少 Location（" + status + "）");
            }
            URI next = uri.resolve(location.trim());
            // 关键：每一跳都重新校验，防"公网域名跳到内网"
            parseAndValidate(next.toString());
            return get(next, depth + 1);
        }
        if (status < 200 || status >= 300) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "站点返回 HTTP " + status + "（可能需要登录或已失效）");
        }

        String contentType = response.headers().firstValue("content-type").orElse("");
        String lower = contentType.toLowerCase(Locale.ROOT);
        if (!lower.contains("html") && !lower.contains("text/plain")) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR,
                    "该链接不是网页（content-type: " + (contentType.isBlank() ? "未知" : contentType) + "）");
        }

        String charsetName = charsetOf(contentType);
        byte[] bytes = readLimited(response.body(), properties.getFetch().getMaxBytes());
        String body = decode(bytes, charsetName);
        return new HttpResult(uri, body);
    }

    private byte[] readLimited(InputStream in, int limit) throws Exception {
        try (InputStream stream = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(Math.min(limit, 64 * 1024));
            byte[] buffer = new byte[8 * 1024];
            int total = 0;
            int read;
            while ((read = stream.read(buffer)) > 0) {
                int remaining = limit - total;
                if (remaining <= 0) {
                    log.info("响应体超过 {} 字节，已截断", limit);
                    break;
                }
                int take = Math.min(read, remaining);
                out.write(buffer, 0, take);
                total += take;
            }
            return out.toByteArray();
        }
    }

    private String decode(byte[] bytes, String charsetName) {
        if (charsetName != null) {
            try {
                return new String(bytes, Charset.forName(charsetName));
            } catch (Exception ignored) {
                // 站点声明了不存在/不支持的字集，退回下面的探测
            }
        }
        String utf8 = new String(bytes, StandardCharsets.UTF_8);
        // 简单探测：UTF-8 解出大量替换符，说明原文多半是 GBK/GB18030
        long broken = utf8.chars().filter(ch -> ch == '\uFFFD').count();
        if (broken > 20) {
            try {
                String gb = new String(bytes, Charset.forName("GB18030"));
                if (gb.chars().filter(ch -> ch == '\uFFFD').count() < broken) {
                    return gb;
                }
            } catch (Exception ignored) {
                // 保留 utf8 结果
            }
        }
        return utf8;
    }

    private String charsetOf(String contentType) {
        if (contentType == null) {
            return null;
        }
        for (String part : contentType.split(";")) {
            String trimmed = part.trim();
            if (trimmed.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                String value = trimmed.substring("charset=".length()).replace("\"", "").trim();
                return value.isEmpty() ? null : value;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ 清洗

    /** 清洗结果 */
    public record Fetched(String title, String byline, String site, String markdown,
                          String rawHtml, String excerpt, int wordCount, String quality, String error) {
    }

    private Fetched extract(String url, String html, String fallbackTitle, String fallbackExcerpt) {
        Document parsed = Jsoup.parse(html == null ? "" : html, url == null ? "" : url);
        String title = firstNonBlank(fallbackTitle, parsed.title(), "");
        String byline = "";
        String contentHtml = null;
        String quality = "ok";

        try {
            Article article = new Readability4J(url == null ? "" : url, parsed).parse();
            if (article != null) {
                title = firstNonBlank(article.getTitle(), title);
                byline = firstNonBlank(article.getByline(), "");
                contentHtml = article.getContent();
            }
        } catch (Exception e) {
            log.warn("readability 解析失败，回退整页文本: url={}, reason={}", url, e.toString());
        }

        String text = contentHtml == null ? "" : Jsoup.parse(contentHtml).text().trim();
        if (text.length() < properties.getFetch().getMinArticleChars()) {
            // 回退：整页可读文本（去脚本/导航/页脚等噪音区块后取 body）
            Document fallback = parsed.clone();
            fallback.select(NOISE_SELECTOR).remove();
            Element body = fallback.body();
            contentHtml = body == null ? "" : body.html();
            quality = "fallback";
            text = body == null ? "" : body.text().trim();
        }

        String markdown = normalizeMarkdown(absolutize(contentHtml, url));
        if (markdown.isBlank() && fallbackExcerpt != null && !fallbackExcerpt.isBlank()) {
            markdown = escapeAsMarkdown(fallbackExcerpt.trim());
            quality = "fallback";
            text = fallbackExcerpt.trim();
        }

        String rawHtml = html != null && html.length() <= properties.getMaxRawHtmlChars() ? html : null;
        String excerpt = excerptOf(text);

        return new Fetched(title, byline, siteOf(url), markdown, rawHtml, excerpt,
                countWords(text), quality, "");
    }

    /** 把正文里的相对图片/链接补成绝对地址，否则剪藏后图片全裂 */
    private String absolutize(String contentHtml, String baseUrl) {
        if (contentHtml == null || contentHtml.isBlank()) {
            return "";
        }
        // baseUri 必须在解析时传入：jsoup 只有在解析阶段已知 baseUri 才会生成 abs:src / abs:href，
        // 解析后再 setBaseUri 是无效的（曾导致相对图片/链接原样留在 Markdown 里）
        Document fragment = Jsoup.parseBodyFragment(contentHtml, baseUrl == null ? "" : baseUrl);
        for (Element img : fragment.select("img[src]")) {
            img.attr("src", img.absUrl("src"));
        }
        for (Element link : fragment.select("a[href]")) {
            String abs = link.absUrl("href");
            if (!abs.isBlank()) {
                link.attr("href", abs);
            }
        }
        Element body = fragment.body();
        return body == null ? contentHtml : body.html();
    }

    private String normalizeMarkdown(String contentHtml) {
        if (contentHtml == null || contentHtml.isBlank()) {
            return "";
        }
        String markdown;
        try {
            markdown = HTML_TO_MD.convert(Jsoup.parseBodyFragment(contentHtml, "").body());
        } catch (Exception e) {
            log.warn("HTML→Markdown 转换失败，回退纯文本: {}", e.toString());
            markdown = Jsoup.parse(contentHtml).text();
        }
        if (markdown == null) {
            return "";
        }
        // 折叠 3 行以上空行（转出来的空行通常比原文夸张），并清掉行尾空格
        String collapsed = markdown.replace("\r\n", "\n").replaceAll("[ \\t]+\\n", "\n");
        collapsed = collapsed.replaceAll("\\n{3,}", "\n\n");
        return collapsed.trim();
    }

    private String excerptOf(String text) {
        if (text == null) {
            return "";
        }
        String compact = text.replaceAll("\\s+", " ").trim();
        return compact.length() <= 200 ? compact : compact.substring(0, 200);
    }

    private int countWords(String text) {
        if (text == null) {
            return 0;
        }
        // 中英混排下"字数"按非空白字符计更直观
        return (int) text.chars().filter(ch -> !Character.isWhitespace(ch)).count();
    }

    private String escapeAsMarkdown(String text) {
        return text.replace("\r\n", "\n").trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String firstLine(String text) {
        String[] lines = text.split("\\n");
        for (String line : lines) {
            if (!line.isBlank()) {
                return line.trim().length() <= 300 ? line.trim() : line.trim().substring(0, 300);
            }
        }
        return "未命名剪藏";
    }

    private String siteOf(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            return host == null ? "" : host.toLowerCase(Locale.ROOT);
        } catch (URISyntaxException e) {
            return "";
        }
    }

    private String shortReason(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            return e.getClass().getSimpleName();
        }
        return message.length() <= 120 ? message : message.substring(0, 120);
    }

    // ------------------------------------------------------------------ SSRF 校验

    /**
     * 解析并校验 URL：协议、端口、主机解析后的 IP 段。
     *
     * @throws BusinessException 参数非法（40000）
     */
    private URI parseAndValidate(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "url 不能为空");
        }
        String trimmed = rawUrl.trim();
        URI uri;
        try {
            uri = new URI(trimmed);
        } catch (URISyntaxException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "url 格式非法");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "只支持 http / https 链接");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "url 缺少主机名");
        }
        int port = uri.getPort();
        if (port != -1 && !ALLOWED_PORTS.contains(port)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持的端口：" + port);
        }
        assertPublicHost(host);
        return uri;
    }

    private void assertPublicHost(String host) {
        String lowerHost = host.toLowerCase(Locale.ROOT);
        if (lowerHost.equals("localhost") || lowerHost.endsWith(".localhost")
                || lowerHost.equals("metadata.google.internal")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不允许抓取内网地址");
        }
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "域名无法解析：" + host);
        }
        for (InetAddress address : addresses) {
            if (isPrivate(address)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "不允许抓取内网地址：" + address.getHostAddress());
            }
        }
    }

    private boolean isPrivate(InetAddress address) {
        if (address.isLoopbackAddress() || address.isAnyLocalAddress()
                || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return true;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = bytes[0] & 0xFF;
            int second = bytes[1] & 0xFF;
            // 100.64.0.0/10 运营商级 NAT、192.0.0.0/24、198.18.0.0/15 保留段
            if (first == 100 && second >= 64 && second <= 127) {
                return true;
            }
            if (first == 192 && second == 0) {
                return true;
            }
            if (first == 198 && (second == 18 || second == 19)) {
                return true;
            }
            return false;
        }
        // IPv6：fc00::/7（唯一本地地址）
        return (bytes[0] & 0xFE) == 0xFC;
    }
}
