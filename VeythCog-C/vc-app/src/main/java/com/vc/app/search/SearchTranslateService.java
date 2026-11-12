package com.vc.app.search;

import com.vc.app.search.dto.TranslateResult;
import com.vc.llm.AuxChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 搜索框首行翻译：中英互译，短文本，24 小时缓存。
 *
 * <p>使用辅助小模型而不是用户当前对话模型，避免搜索框翻译被对话模型选择影响；
 * 失败由调用方按“隐藏翻译行”降级。</p>
 */
@Service
public class SearchTranslateService {

    private static final Logger log = LoggerFactory.getLogger(SearchTranslateService.class);

    private static final int MAX_INPUT_CHARS = 500;
    private static final int MAX_CACHE_ENTRIES = 1000;
    private static final long CACHE_TTL_SECONDS = 24 * 60 * 60;

    private static final String SYSTEM_PROMPT = """
            你是专业翻译引擎。把用户给出的内容翻译成目标语言。
            要求：
            1. 只输出译文，不要解释、不要加引号、不要输出“译文：”前缀；
            2. 保持原文语气、专业术语和数字格式；
            3. 原文已经是目标语言时原样返回；
            4. 不要补充原文没有的信息。
            """;

    private final AuxChatService auxChatService;
    private final Map<String, CachedTranslation> cache = new ConcurrentHashMap<>();

    public SearchTranslateService(AuxChatService auxChatService) {
        this.auxChatService = auxChatService;
    }

    public TranslateResult translate(String rawText, String requestedTarget) {
        String text = rawText == null ? "" : rawText.trim();
        if (text.isEmpty()) {
            return new TranslateResult("unknown", "zh", "", false);
        }
        if (text.length() > MAX_INPUT_CHARS) {
            text = text.substring(0, MAX_INPUT_CHARS);
        }

        String sourceLang = detectLang(text);
        String targetLang = normalizeTarget(requestedTarget, sourceLang);
        String key = targetLang + ":" + text.toLowerCase(Locale.ROOT);
        CachedTranslation cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return new TranslateResult(sourceLang, targetLang, cached.text(), true);
        }

        String userPrompt = "目标语言：" + ("en".equals(targetLang) ? "英文" : "中文")
                + "\n原文：\n" + text;
        String translated = auxChatService.complete(SYSTEM_PROMPT, userPrompt);
        translated = clean(translated);
        if (translated.isEmpty()) {
            translated = text;
        }

        cache.put(key, new CachedTranslation(translated, Instant.now().plusSeconds(CACHE_TTL_SECONDS)));
        trimCache();
        log.debug("搜索翻译完成: source={}, target={}, cached=false, length={}",
                sourceLang, targetLang, text.length());
        return new TranslateResult(sourceLang, targetLang, translated, false);
    }

    private static String normalizeTarget(String requested, String sourceLang) {
        if (requested != null) {
            String t = requested.trim().toLowerCase(Locale.ROOT);
            if ("zh".equals(t) || "en".equals(t)) {
                return t;
            }
        }
        return "zh".equals(sourceLang) ? "en" : "zh";
    }

    /**
     * 粗粒度语言识别：汉字数量占优判中文，否则判英文；混合输入按目标语言推断。
     */
    private static String detectLang(String text) {
        int han = 0;
        int latin = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c >= '\u4e00' && c <= '\u9fff') {
                han++;
            } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                latin++;
            }
        }
        if (han > 0 && han >= latin * 0.3) {
            return "zh";
        }
        return latin > 0 ? "en" : "unknown";
    }

    private static String clean(String value) {
        if (value == null) {
            return "";
        }
        String result = value.trim();
        if (result.startsWith("```") && result.endsWith("```")) {
            result = result.substring(3, result.length() - 3).trim();
        }
        if ((result.startsWith("\"") && result.endsWith("\""))
                || (result.startsWith("“") && result.endsWith("”"))) {
            result = result.substring(1, result.length() - 1).trim();
        }
        if (result.startsWith("译文：")) {
            result = result.substring(3).trim();
        }
        return result;
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

    private record CachedTranslation(String text, Instant expiresAt) {
    }
}
