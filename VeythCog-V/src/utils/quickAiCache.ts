/**
 * 划词 AI 前端缓存（localStorage，24h）
 * ------------------------------------------------------------
 * 后端也有一层 TTL 缓存（进程内 24h）。这层存在的理由只有一个：命中时 0ms 出结果，
 * 不必等网络往返 —— 划词是"随手看一眼"的交互，200ms 的空窗都很明显。
 *
 * 只存结果文本，不存选中原文（键里包含原文的哈希），避免把用户选中的敏感内容明写成明文。
 * `ask` 与 `withKnowledge=true` 不进缓存：问答的答案依赖上下文，缓存会给出过期结论。
 */
import type { QuickAiAction } from '@/api/quickAi';

const PREFIX = 'vc:quickai:';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

interface CacheEntry {
  text: string;
  at: number;
}

/** FNV-1a：非加密场景够用，且不依赖 crypto.subtle（http 页面也能跑） */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function keyOf(action: QuickAiAction, text: string): string {
  return `${PREFIX}${action}:${hash(`${action}|${text}`)}`;
}

function readAllKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
  } catch {
    // 隐私模式下 localStorage 不可写，直接当没有缓存
  }
  return keys;
}

export function getCachedQuickAi(
  action: QuickAiAction,
  text: string,
): { text: string; at: number } | null {
  if (action === 'ask') return null;
  try {
    const raw = localStorage.getItem(keyOf(action, text));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry?.text || Date.now() - entry.at > TTL_MS) {
      localStorage.removeItem(keyOf(action, text));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function setCachedQuickAi(action: QuickAiAction, text: string, result: string): void {
  if (action === 'ask' || !result.trim()) return;
  try {
    const keys = readAllKeys();
    if (keys.length >= MAX_ENTRIES) {
      // 先清过期的，仍然满就删最旧的一批
      let removed = 0;
      keys.forEach((key) => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) ?? '') as CacheEntry;
          if (Date.now() - entry.at > TTL_MS) {
            localStorage.removeItem(key);
            removed += 1;
          }
        } catch {
          localStorage.removeItem(key);
          removed += 1;
        }
      });
      if (removed === 0 && keys.length >= MAX_ENTRIES) {
        keys.slice(0, 40).forEach((key) => localStorage.removeItem(key));
      }
    }
    localStorage.setItem(keyOf(action, text), JSON.stringify({ text: result, at: Date.now() }));
  } catch {
    // 空间不足/隐私模式：放弃缓存，不影响主流程
  }
}

export function clearQuickAiLocalCache(): void {
  readAllKeys().forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // 单个失败无所谓
    }
  });
}

/** 缓存条数（设置页展示"已缓存 N 条"） */
export function countQuickAiLocalCache(): number {
  return readAllKeys().filter((key) => {
    try {
      const entry = JSON.parse(localStorage.getItem(key) ?? '') as CacheEntry;
      return entry?.text && Date.now() - entry.at <= TTL_MS;
    } catch {
      return false;
    }
  }).length;
}
