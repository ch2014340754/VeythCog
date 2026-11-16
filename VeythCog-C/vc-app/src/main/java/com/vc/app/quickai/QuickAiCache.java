package com.vc.app.quickai;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 划词 AI 结果缓存（进程内 TTL Map）。
 *
 * <p>用途：同一段文字、同一动作、同一模型，24 小时内不重复花 token。
 * 第二层（前端 localStorage）负责 0ms 命中，这一层负责"换浏览器 / 换设备 / 刷新后仍命中"。</p>
 *
 * <p>只缓存纯模型动作（解释/翻译/润色）：带知识库检索的答案不缓存 —— 检索上下文会随
 * 知识库变化，缓存会给出"有引用但已过期"的答案。</p>
 */
@Component
public class QuickAiCache {

    /** 单条正文上限：太长的回答塞得多，命中率低还会撑内存 */
    private static final int MAX_CACHED_CHARS = 12_000;

    private record Entry(String text, long createdAt) {
    }

    private final Map<String, Entry> store = new ConcurrentHashMap<>();

    private final int maxEntries = 500;

    private final long ttlMillis = 24L * 60 * 60 * 1000;

    public String get(String key) {
        if (key == null) {
            return null;
        }
        Entry entry = store.get(key);
        if (entry == null) {
            return null;
        }
        if (System.currentTimeMillis() - entry.createdAt() >= ttlMillis) {
            store.remove(key);
            return null;
        }
        return entry.text();
    }

    /** 命中时间（epoch 毫秒）；未命中返回 null */
    public Long cachedAt(String key) {
        Entry entry = key == null ? null : store.get(key);
        return entry == null ? null : entry.createdAt();
    }

    public void put(String key, String text) {
        if (key == null || text == null || text.isBlank() || text.length() > MAX_CACHED_CHARS) {
            return;
        }
        if (store.size() >= maxEntries) {
            evict();
        }
        store.put(key, new Entry(text, System.currentTimeMillis()));
    }

    public void clear() {
        store.clear();
    }

    /** 先清过期，仍满则清最旧的一批（无第三方依赖，够用即可） */
    private void evict() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> now - e.getValue().createdAt() >= ttlMillis);
        if (store.size() < maxEntries) {
            return;
        }
        store.entrySet().stream()
                .sorted(Map.Entry.comparingByValue((a, b) -> Long.compare(a.createdAt(), b.createdAt())))
                .limit(Math.max(1, maxEntries / 5))
                .map(Map.Entry::getKey)
                .toList()
                .forEach(store::remove);
    }
}
