/**
 * 对话 API
 * - 会话管理（本地 mock，P0 不做持久化）
 * - 发消息调后端真实模型接口 POST /chat/message（同步）
 * - 流式对话走 POST /chat/stream（SSE，逐 token 下发）
 */
import type { Conversation } from '@/types';
import { http } from '@/api/client';
import { config } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { mockConversations } from '@/mock/chat';

// 内存中的会话数据副本（模拟数据库，P0 本地）
let conversations: Conversation[] = JSON.parse(JSON.stringify(mockConversations));

/** 模拟异步延迟 */
function delay(ms: number = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 生成唯一ID */
function generateId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取会话列表 */
export async function getConversations(): Promise<Conversation[]> {
  await delay();
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 创建新会话（可绑定模型） */
export async function createConversation(
  title: string,
  model?: { vendor?: string; modelCode?: string; modelName?: string }
): Promise<Conversation> {
  await delay();
  const now = Date.now();
  const newConversation: Conversation = {
    id: generateId(),
    title,
    lastMessage: '',
    messages: [],
    knowledgeBaseId: null,
    ...model,
    createdAt: now,
    updatedAt: now,
  };
  conversations = [newConversation, ...conversations];
  return newConversation;
}

/** 删除会话 */
export async function deleteConversation(id: string): Promise<void> {
  await delay();
  conversations = conversations.filter((c) => c.id !== id);
}

/** 发送消息到指定模型，返回 AI 回复文本（真实后端同步调用）。
 *  @param conversationId 当前会话 id，后端用它做会话隔离与记忆 */
export async function sendMessage(
  content: string,
  vendor: string,
  modelCode: string,
  conversationId?: string | null
): Promise<string> {
  const reply = await http.post<string>('/chat/message', {
    message: content,
    vendor,
    modelCode,
    conversationId,
  });
  return reply;
}

export interface StreamChatMessageOptions {
  message: string;
  vendor: string;
  modelCode: string;
  conversationId?: string | null;
  /** 增量文本回调（每到达一个 token 触发一次） */
  onDelta: (text: string) => void;
  /** 完成回调（收到 [DONE] 或流自然结束） */
  onDone?: () => void;
  /** 错误回调（非中断错误） */
  onError?: (e: Error) => void;
}

/**
 * 流式对话（SSE）：POST /chat/stream，fetch + ReadableStream 解析。
 * 后端事件格式：data: <token>\n\n，末尾 data: [DONE]\n\n。
 * 返回 AbortController，可中断（中断会传导到后端取消上游生成）。
 */
export function streamChatMessage(o: StreamChatMessageOptions): AbortController {
  const controller = new AbortController();
  const token = useAuthStore.getState().token;

  (async () => {
    try {
      const resp = await fetch(`${config.apiBase}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: o.message,
          vendor: o.vendor,
          modelCode: o.modelCode,
          conversationId: o.conversationId ?? undefined,
        }),
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

        // SSE 事件以 \n\n 分隔
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          // 取事件名与最后一个 data: 行
          let eventName: string | null = null;
          let data: string | null = null;
          for (const line of evt.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) data = line.slice(5);
          }
          if (data === null) continue;
          const text = data.trimStart();
          if (eventName === 'error') {
            o.onError?.(new Error(text || '模型调用失败'));
            return;
          }
          if (text === '[DONE]') {
            o.onDone?.();
            return;
          }
          if (text) o.onDelta(text);
        }
      }
      o.onDone?.();
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      o.onError?.(e);
    }
  })();

  return controller;
}
