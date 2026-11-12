/**
 * 导航搜索增强 API：
 * - 输入联想（后端代理远端 suggest）
 * - 首行翻译（后端辅助模型，24h 缓存）
 * - 搜索 AI（无记忆 SSE，不写对话历史）
 * - 最近搜索 / 偏好本地存储
 */
import { apiUrl, http, request } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import type { RetrieveChunk } from '@/types';

export interface SearchStatus {
  knowledgeAvailable: boolean;
  vendor?: string | null;
  modelCode?: string | null;
  modelName?: string | null;
}

export interface SearchTranslation {
  sourceLang: string;
  targetLang: 'zh' | 'en' | string;
  translatedText: string;
  cached: boolean;
}

export interface SearchAiMeta {
  modelName?: string;
  knowledgeFirst?: boolean;
  knowledgeAvailable?: boolean;
  knowledgeHit?: boolean;
}

export interface SearchHistoryItem {
  text: string;
  count: number;
  at: number;
}

export type SearchSuggestionType = 'history' | 'bookmark' | 'remote';

export interface SearchSuggestion {
  type: SearchSuggestionType;
  text: string;
  /** 书签建议才有 */
  bookmarkId?: number;
  url?: string;
}

const HISTORY_KEY = 'veythcog:search:history';
const KB_FIRST_KEY = 'veythcog:search:kb-first';
const HISTORY_LIMIT = 20;

export const getSearchSuggest = (query: string, engine: string) =>
  request<string[]>('/search/suggest', {
    query: { q: query, engine },
    timeout: 3000,
  });

export const translateSearch = (text: string, targetLang?: string) =>
  request<SearchTranslation>('/search/translate', {
    method: 'POST',
    body: { text, targetLang },
    timeout: 5000,
  });

export const getSearchStatus = () => http.get<SearchStatus>('/search/status');

/** 读取最近搜索（本地，最多 20 条） */
export function readSearchHistory(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is SearchHistoryItem => !!x && typeof x.text === 'string')
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** 记录一次实际执行的网页搜索 */
export function recordSearchHistory(text: string): void {
  const q = text.trim();
  if (!q) return;
  const list = readSearchHistory();
  const existing = list.find((x) => x.text === q);
  const next = existing
    ? list.map((x) => (x.text === q ? { ...x, count: x.count + 1, at: Date.now() } : x))
    : [{ text: q, count: 1, at: Date.now() }, ...list];
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, HISTORY_LIMIT)));
  } catch {
    // localStorage 不可用时静默忽略，不影响搜索
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function readKnowledgeFirst(): boolean {
  try {
    return localStorage.getItem(KB_FIRST_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeKnowledgeFirst(value: boolean): void {
  try {
    localStorage.setItem(KB_FIRST_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export interface StreamSearchAiOptions {
  query: string;
  knowledgeFirst: boolean;
  onMeta?: (meta: SearchAiMeta) => void;
  onReferences?: (references: RetrieveChunk[]) => void;
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 搜索 AI 流式请求。后端事件：meta → references → data(token) → [DONE]。
 * 返回 AbortController，关闭面板或重新输入时中断。
 */
export function streamSearchAi(options: StreamSearchAiOptions): AbortController {
  const controller = new AbortController();
  const token = useAuthStore.getState().token;
  let completed = false;

  const finish = () => {
    if (completed) return;
    completed = true;
    options.onDone?.();
  };

  (async () => {
    try {
      const resp = await fetch(apiUrl('/search/ai/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: options.query,
          knowledgeFirst: options.knowledgeFirst,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || `搜索回答请求失败 (${resp.status})`);
      }
      if (!resp.body) throw new Error('搜索回答响应为空');

      // 业务异常可能以普通 JSON 返回（如未绑定模型），不是 SSE；先识别再解析
      const contentType = resp.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        const text = await resp.text().catch(() => '');
        let messageText = '';
        try {
          const body = JSON.parse(text) as { message?: string };
          messageText = body?.message ?? '';
        } catch {
          messageText = text;
        }
        throw new Error(messageText || '搜索回答请求失败');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const event = parseSseEvent(evt);
          if (!event) continue;
          if (event.event === 'error') {
            options.onError?.(new Error(event.data || '搜索回答失败'));
            completed = true;
            return;
          }
          if (event.event === 'meta') {
            try {
              const meta = JSON.parse(event.data) as SearchAiMeta;
              options.onMeta?.(meta);
            } catch {
              // 元信息解析失败不影响正文
            }
            continue;
          }
          if (event.event === 'references') {
            try {
              const refs = JSON.parse(event.data) as RetrieveChunk[];
              if (Array.isArray(refs)) options.onReferences?.(refs);
            } catch {
              // 引用解析失败不影响正文
            }
            continue;
          }
          if (event.data.trim() === '[DONE]') {
            finish();
            return;
          }
          if (event.data) options.onDelta(event.data);
        }
      }
      finish();
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      options.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return controller;
}

function parseSseEvent(block: string): { event: string | null; data: string } | null {
  let event: string | null = null;
  const data: string[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    if (rawLine.startsWith('event:')) {
      event = rawLine.slice(6).trim();
    } else if (rawLine.startsWith('data:')) {
      let line = rawLine.slice(5);
      if (line.startsWith(' ')) line = line.slice(1);
      data.push(line);
    }
  }
  if (!data.length) return null;
  return { event, data: data.join('\n') };
}
