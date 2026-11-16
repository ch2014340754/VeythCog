/**
 * SSE 解析（通用）
 * ------------------------------------------------------------
 * 后端统一格式：`event: <name>\ndata: <payload>\n\n`，流末尾是一帧 `data: [DONE]`。
 * 对话页（api/chat.ts）历史上自己写了一份解析；新增的划词 AI 与后续流式接口共用这一份，
 * 避免每加一个流式接口就复制一遍 while/decoder 逻辑。
 *
 * 约定：`event: token` 帧的 payload 可能是 `{"t":"..."}`（正文含换行时必须这样包），
 * 其它事件（meta / references / error）payload 一律是 JSON 或纯文本，由调用方自行解释。
 */
import { config } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { useModeStore } from '@/stores/modeStore';

export interface SseHandlers {
  /** 每帧回调；返回 true 表示就此停止读取（例如收到错误） */
  onEvent: (event: string | null, data: string) => boolean | void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

function apiBase(): string {
  return useModeStore.getState().apiBase || config.apiBase;
}

/**
 * POST 一个 SSE 接口。返回 AbortController，调用方可用它中断。
 */
export function streamSsePost(path: string, body: unknown, handlers: SseHandlers): AbortController {
  const controller = new AbortController();
  const token = useAuthStore.getState().token;

  (async () => {
    try {
      const resp = await fetch(`${apiBase()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`请求失败 (${resp.status})`);
      }
      const contentType = resp.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        // 参数校验/业务异常会以 JSON 返回，别当成"空回复"
        const payload = (await resp.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || '请求失败');
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          let eventName: string | null = null;
          const dataLines: string[] = [];
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5));
          }
          if (dataLines.length === 0) continue;
          const data = dataLines.join('\n').trimStart();

          if (data === '[DONE]') {
            handlers.onDone?.();
            reader.cancel().catch(() => undefined);
            finished = true;
            break;
          }
          if (handlers.onEvent(eventName, data) === true) {
            reader.cancel().catch(() => undefined);
            finished = true;
            break;
          }
        }
      }
      if (!finished) handlers.onDone?.();
    } catch (e) {
      const error = e as Error;
      if (error.name === 'AbortError') return;
      handlers.onError?.(error);
    }
  })();

  return controller;
}

/** 解出 `event: token` 帧里的正文（兼容 {"t":...} 与裸文本两种格式） */
export function readTokenPayload(data: string): string {
  try {
    const payload = JSON.parse(data) as { t?: string };
    if (typeof payload.t === 'string') return payload.t;
  } catch {
    // 裸文本
  }
  return data;
}
