package com.vc.nav.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3FileValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 站点图标抓取器：从书签 URL 解析站点图标并返回原始字节。
 *
 * <p>只做「取到一张合法图片」这一件事，不碰数据库 / S3，方便单独测试。</p>
 *
 * <p>安全约束：</p>
 * <ul>
 *   <li>只允许 http/https；DNS 解析后拒绝回环 / 私网 / link-local / 组播地址（防 SSRF）；</li>
 *   <li>页面与图片都有 512KB 硬上限、6s 超时，避免被大文件拖死；</li>
 *   <li>图片类型只认文件头魔数，不信任 URL 后缀与 Content-Type（很多站点用 .ico 承载 PNG）；</li>
 *   <li>SVG 没有魔数、公开桶又可能被浏览器直接执行脚本，直接拒绝。</li>
 * </ul>
 */
@Slf4j
@Component
public class SiteIconFetcher {

    /** 页面 HTML 读取上限 */
    private static final int MAX_HTML_BYTES = 512 * 1024;

    /** 图标文件读取上限（自定义上传也按同一标准） */
    private static final int MAX_ICON_BYTES = 512 * 1024;

    /** 最多尝试的候选图标地址，避免异常站点拖出几十个请求 */
    private static final int MAX_CANDIDATES = 6;

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(6);

    private static final Pattern LINK_TAG = Pattern.compile("<link\\b[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern REL_ATTR = Pattern.compile(
            "\\brel\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", Pattern.CASE_INSENSITIVE);
    private static final Pattern HREF_ATTR = Pattern.compile(
            "\\bhref\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_TAG = Pattern.compile(
            "<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TAG = Pattern.compile("<[^>]+>");

    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 VeythCogIconFetcher/1.0";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /**
     * 抓取站点图标。
     *
     * @param rawUrl 书签 URL（必须 http/https）
     * @return 图标字节 + 真实类型 + 站点标题
     * @throws BusinessException 参数非法或所有候选都取不到合法图片
     */
    public FetchedIcon fetch(String rawUrl) {
        URI site = parseHttpUri(rawUrl);
        requirePublicTarget(site);

        String siteTitle = null;
        List<URI> candidates = new ArrayList<>();

        try {
            HttpResponse<InputStream> response = get(site, "text/html,application/xhtml+xml", null);
            try (InputStream body = response.body()) {
                if (isSuccessful(response.statusCode())) {
                    requirePublicTarget(response.uri());
                    byte[] html = readLimited(body, MAX_HTML_BYTES);
                    String text = new String(html, StandardCharsets.UTF_8);
                    siteTitle = extractTitle(text);
                    for (String href : extractIconHrefs(text)) {
                        addCandidate(candidates, resolve(site, href));
                    }
                }
            }
        } catch (Exception e) {
            // 页面取不到不影响回退到同源 favicon.ico
            log.debug("读取站点页面失败 url={}：{}", rawUrl, e.getMessage());
        }

        URI origin = originOf(site);
        addCandidate(candidates, resolve(origin, "/favicon.ico"));
        addCandidate(candidates, resolve(origin, "/apple-touch-icon.png"));
        addCandidate(candidates, resolve(origin, "/apple-touch-icon-precomposed.png"));

        int tried = 0;
        for (URI candidate : candidates) {
            if (tried++ >= MAX_CANDIDATES) {
                break;
            }
            try {
                HttpResponse<InputStream> response = get(candidate, "image/*,*/*;q=0.8", origin.toString());
                try (InputStream body = response.body()) {
                    if (!isSuccessful(response.statusCode())) {
                        continue;
                    }
                    requirePublicTarget(response.uri());
                    byte[] data = readLimited(body, MAX_ICON_BYTES);
                    if (data.length < 4) {
                        continue;
                    }
                    byte[] head = Arrays.copyOf(data, Math.min(16, data.length));
                    String mime = S3FileValidator.detectMimeType(head);
                    String extension = extensionOf(mime);
                    if (extension == null) {
                        continue;
                    }
                    return new FetchedIcon(data, extension, mime, candidate.toString(), siteTitle);
                }
            } catch (Exception e) {
                log.debug("候选图标不可用 url={}：{}", candidate, e.getMessage());
            }
        }
        throw new BusinessException(ErrorCode.PARAMS_ERROR, "未能获取网站图标，请改用上传图片或文字图标");
    }

    private HttpResponse<InputStream> get(URI uri, String accept, String referer) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("Accept", accept);
        if (referer != null && !referer.isBlank()) {
            // 部分站点 CDN 有防盗链，带站点 Referer 才能取到图标
            builder.header("Referer", referer);
        }
        HttpRequest request = builder.GET().build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
    }

    private static boolean isSuccessful(int status) {
        return status >= 200 && status < 300;
    }

    private static URI parseHttpUri(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "网址不能为空");
        }
        String trimmed = rawUrl.trim();
        if (!trimmed.matches("(?i)^https?://.+")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "网址必须以 http:// 或 https:// 开头");
        }
        try {
            return URI.create(trimmed);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "网址格式不正确");
        }
    }

    /**
     * SSRF 防护：只允许解析到公网地址的 http/https 目标。
     * <p>DNS 解析失败按非法处理；重定向后的地址也要再过一次。</p>
     */
    private static void requirePublicTarget(URI uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "网址格式不正确");
        }
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "只支持 http/https 地址");
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (host.equals("localhost") || host.endsWith(".localhost") || host.endsWith(".local")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不允许访问本机或内网地址");
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (!isPublicAddress(address)) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR, "不允许访问本机或内网地址");
                }
            }
        } catch (UnknownHostException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "网址域名无法解析");
        }
    }

    private static boolean isPublicAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return false;
        }
        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = bytes[0] & 0xFF;
            int second = bytes[1] & 0xFF;
            // 0.0.0.0/8、127/8、169.254/16、100.64/10（运营商级 NAT）
            if (first == 0 || first == 127
                    || (first == 169 && second == 254)
                    || (first == 100 && second >= 64 && second <= 127)) {
                return false;
            }
        } else if (bytes.length == 16) {
            // fc00::/7 唯一本地地址
            int first = bytes[0] & 0xFF;
            if ((first & 0xFE) == 0xFC) {
                return false;
            }
        }
        return true;
    }

    private static URI originOf(URI uri) {
        String scheme = uri.getScheme();
        String authority = uri.getRawAuthority();
        return URI.create(scheme + "://" + authority + "/");
    }

    private static URI resolve(URI base, String href) {
        try {
            String trimmed = href.trim().replace("&amp;", "&");
            if (trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) {
                return null;
            }
            return base.resolve(trimmed);
        } catch (Exception e) {
            return null;
        }
    }

    private static void addCandidate(List<URI> candidates, URI candidate) {
        if (candidate == null || candidate.getHost() == null) {
            return;
        }
        String scheme = candidate.getScheme() == null ? "" : candidate.getScheme().toLowerCase(Locale.ROOT);
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return;
        }
        String normalized = candidate.toString();
        for (URI existing : candidates) {
            if (existing.toString().equals(normalized)) {
                return;
            }
        }
        candidates.add(candidate);
    }

    private static Set<String> extractIconHrefs(String html) {
        Set<String> hrefs = new LinkedHashSet<>();
        Matcher linkMatcher = LINK_TAG.matcher(html);
        while (linkMatcher.find()) {
            String tag = linkMatcher.group();
            String rel = attr(REL_ATTR, tag);
            if (rel == null || !rel.toLowerCase(Locale.ROOT).contains("icon")) {
                continue;
            }
            String href = attr(HREF_ATTR, tag);
            if (href != null && !href.isBlank()) {
                hrefs.add(href);
            }
        }
        return hrefs;
    }

    private static String attr(Pattern pattern, String tag) {
        Matcher matcher = pattern.matcher(tag);
        if (!matcher.find()) {
            return null;
        }
        for (int i = 2; i <= 4; i++) {
            if (matcher.group(i) != null) {
                return matcher.group(i);
            }
        }
        return null;
    }

    private static String extractTitle(String html) {
        Matcher matcher = TITLE_TAG.matcher(html);
        if (!matcher.find()) {
            return null;
        }
        String raw = TAG.matcher(matcher.group(1)).replaceAll(" ");
        String title = decodeEntities(raw).replaceAll("\\s+", " ").trim();
        if (title.isEmpty()) {
            return null;
        }
        return title.length() > 64 ? title.substring(0, 64) : title;
    }

    private static String decodeEntities(String value) {
        return value
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&nbsp;", " ");
    }

    private static byte[] readLimited(InputStream input, int maxBytes) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            if (out.size() + read > maxBytes) {
                throw new IOException("响应体超过 " + maxBytes + " 字节上限");
            }
            out.write(buffer, 0, read);
        }
        return out.toByteArray();
    }

    private static String extensionOf(String mime) {
        if (mime == null) {
            return null;
        }
        return switch (mime) {
            case "image/png" -> "png";
            case "image/jpeg" -> "jpg";
            case "image/gif" -> "gif";
            case "image/webp" -> "webp";
            case "image/bmp" -> "bmp";
            case "image/x-icon" -> "ico";
            default -> null;
        };
    }

    /**
     * 抓取结果。
     *
     * @param data      原始图片字节
     * @param extension 由魔数推导的真实后缀
     * @param mimeType  由魔数推导的真实 MIME
     * @param sourceUrl 实际命中的候选地址
     * @param siteTitle 页面标题（可能为空）
     */
    public record FetchedIcon(byte[] data, String extension, String mimeType, String sourceUrl, String siteTitle) {
    }
}
