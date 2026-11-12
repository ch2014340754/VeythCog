package com.vc.app.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 搜索引擎输入联想代理。
 *
 * <p>前端只请求本接口，避免百度 / Google / Bing 的跨域限制；远端失败一律返回空数组，
 * 前端用本地书签 / 历史兜底，不把第三方站点的不稳定暴露给用户。</p>
 */
@Service
public class SearchSuggestService {

    private static final Logger log = LoggerFactory.getLogger(SearchSuggestService.class);

    private static final Duration TIMEOUT = Duration.ofMillis(350);
    private static final int MAX_QUERY_CHARS = 60;
    private static final int MAX_RESULTS = 8;
    private static final int MAX_CACHE_ENTRIES = 2000;
    private static final long CACHE_TTL_SECONDS = 300;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .build();
    private final ObjectMapper objectMapper;
    private final Map<String, CachedSuggest> cache = new ConcurrentHashMap<>();

    public SearchSuggestService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<String> suggest(String engine, String query) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty() || q.length() > MAX_QUERY_CHARS) {
            return List.of();
        }
        String normalizedEngine = normalizeEngine(engine);
        String key = normalizedEngine + ":" + q.toLowerCase(Locale.ROOT);
        CachedSuggest cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.items();
        }

        try {
            String url = suggestUrl(normalizedEngine, q);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(TIMEOUT)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VeythCog-Search")
                    .header("Accept", "application/json,text/javascript,*/*")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.debug("搜索联想远端返回非 200: engine={}, status={}", normalizedEngine, response.statusCode());
                return List.of();
            }
            String body = decode(response.body(), response.headers().firstValue("Content-Type").orElse(""), normalizedEngine);
            List<String> items = parse(normalizedEngine, body);
            cache.put(key, new CachedSuggest(items, Instant.now().plusSeconds(CACHE_TTL_SECONDS)));
            trimCache();
            return items;
        } catch (Exception e) {
            // 联想是增强能力，远端超时/被拦截时静默降级，不缓存失败结果
            log.debug("搜索联想远端失败: engine={}, query={}, error={}", normalizedEngine, q, e.getMessage());
            return List.of();
        }
    }

    private static String suggestUrl(String engine, String query) {
        String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
        return switch (engine) {
            case "google" -> "https://suggestqueries.google.com/complete/search?client=firefox&q=" + encoded;
            case "bing" -> "https://api.bing.com/osjson.aspx?query=" + encoded;
            // 百度默认按 GBK 返回；显式要求 UTF-8，避免中文联想被按 GBK 解码成乱码
            default -> "https://suggestion.baidu.com/su?wd=" + encoded + "&ie=utf-8&oe=utf-8&cb=";
        };
    }

    /**
     * 按响应头 charset 解码；百度未声明 charset 时按 GB18030 兜底。
     */
    private static String decode(byte[] bytes, String contentType, String engine) {
        Charset charset = null;
        if (contentType != null) {
            String lower = contentType.toLowerCase(Locale.ROOT);
            int index = lower.indexOf("charset=");
            if (index >= 0) {
                String value = contentType.substring(index + "charset=".length()).split(";")[0].trim();
                if (value.startsWith("\"") && value.endsWith("\"") && value.length() > 1) {
                    value = value.substring(1, value.length() - 1);
                }
                try {
                    charset = Charset.forName(value);
                } catch (Exception ignored) {
                    // 非法 charset 交给兜底
                }
            }
        }
        if (charset == null) {
            charset = "baidu".equals(engine) ? Charset.forName("GB18030") : StandardCharsets.UTF_8;
        }
        return new String(bytes, charset);
    }

    private List<String> parse(String engine, String body) {
        if (body == null || body.isBlank()) {
            return List.of();
        }
        try {
            JsonNode node;
            if ("baidu".equals(engine)) {
                String array = extractArray(body, "s:");
                if (array == null) {
                    return List.of();
                }
                node = objectMapper.readTree(array);
            } else {
                String array = extractArray(body, null);
                if (array == null) {
                    return List.of();
                }
                node = objectMapper.readTree(array);
            }
            if (node == null || !node.isArray()) {
                return List.of();
            }
            // Google/Bing 返回 ["query", ["s1", "s2"]]，百度返回 ["s1", "s2"]
            if (node.size() > 1 && node.get(1).isArray()) {
                node = node.get(1);
            }
            Set<String> unique = new LinkedHashSet<>();
            List<String> result = new ArrayList<>(MAX_RESULTS);
            for (JsonNode item : node) {
                String text = item.isTextual() ? item.asText() : item.asText("");
                text = text == null ? "" : text.trim().replaceAll("\\s+", " ");
                if (text.isEmpty() || text.length() > 100) {
                    continue;
                }
                if (unique.add(text) && result.size() < MAX_RESULTS) {
                    result.add(text);
                }
            }
            return result;
        } catch (Exception e) {
            log.debug("搜索联想解析失败: engine={}, error={}", engine, e.getMessage());
            return List.of();
        }
    }

    /**
     * 从响应体中截取第一个 JSON 数组，支持 JSONP 包裹；字符串内的括号会被正确跳过。
     */
    private static String extractArray(String body, String marker) {
        int markerIndex = marker == null ? 0 : body.indexOf(marker);
        int start = body.indexOf('[', markerIndex);
        if (start < 0) {
            return null;
        }
        boolean inString = false;
        boolean escaped = false;
        int depth = 0;
        for (int i = start; i < body.length(); i++) {
            char c = body.charAt(i);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            if (c == '"') {
                inString = true;
            } else if (c == '[') {
                depth++;
            } else if (c == ']') {
                depth--;
                if (depth == 0) {
                    return body.substring(start, i + 1);
                }
            }
        }
        return null;
    }

    private static String normalizeEngine(String engine) {
        String e = engine == null ? "" : engine.trim().toLowerCase(Locale.ROOT);
        return switch (e) {
            case "google", "bing" -> e;
            default -> "baidu";
        };
    }

    private void trimCache() {
        if (cache.size() <= MAX_CACHE_ENTRIES) {
            return;
        }
        Instant now = Instant.now();
        cache.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));
        if (cache.size() > MAX_CACHE_ENTRIES) {
            cache.clear();
        }
    }

    private record CachedSuggest(List<String> items, Instant expiresAt) {
    }
}
