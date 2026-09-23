/**
 * SSE 流式请求封装（fetch + ReadableStream）
 * 原生 EventSource 不能带 Authorization header，这里用 fetch 手动解析 SSE chunk
 *
 * 用法：
 *   const controller = streamChat({
 *     body: { model: 'gpt-4o', messages: [...] },
 *     onDelta: (text) => appendToMessage(text),
 *     onDone: () => finalizeMessage(),
 *     onError: (e) => showError(e),
 *   });
 *   // 中断：controller.abort()
 *
 * 后端对接：
 *   - OpenAI 兼容协议：POST {llmBase}/chat/completions，body 带 stream: true
 *   - 返回 SSE 流，每行 data: {...}\n\n，[DONE] 结束
 */

import { config } from '@/config';
import { useAuthStore } from '@/stores/authStore';

export interface StreamOptions {
  /** 请求体（OpenAI 兼容格式，必须含 stream: true） */
  body: unknown;
  /** 增量文本回调 */
  onDelta: (text: string) => void;
  /** 完成回调 */
  onDone?: () => void;
  /** 错误回调 */
  onError?: (e: Error) => void;
  /** 自定义 path，默认 /chat/completions */
  path?: string;
}

export function streamChat(opts: StreamOptions): AbortController {
  const controller = new AbortController();
  const token = useAuthStore.getState().token;

  (async () => {
    try {
      const resp = await fetch(config.llmBase + (opts.path ?? '/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(opts.body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`流式请求失败 (${resp.status})`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 以 \n\n 分隔事件
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            opts.onDone?.();
            return;
          }
          try {
            const json = JSON.parse(data);
            // OpenAI 兼容：choices[0].delta.content
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) opts.onDelta(delta);
          } catch {
            // 非 JSON 的注释行，忽略
          }
        }
      }
      opts.onDone?.();
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      opts.onError?.(e);
    }
  })();

  return controller;
}
