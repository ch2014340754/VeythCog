/**
 * 对话 API
 * - 会话列表 / 历史消息 / 删除：走后端（数据源为 chat_message 记忆表，无本地 mock）
 * - 发消息调后端真实模型接口 POST /chat/message（同步）
 * - 流式对话走 POST /chat/stream（SSE，逐 token 下发）
 */
import type { Conversation, Message, RetrieveChunk } from '@/types';
import { http } from '@/api/client';
import { config } from '@/config';
import { useAuthStore } from '@/stores/authStore';

/** 后端会话列表项（chat_message 聚合 + chat_session 配置合并） */
interface RemoteConversation {
  id: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  vendor?: string | null;
  modelCode?: string | null;
  knowledgeDocIds?: number[] | null;
  compressEnabled?: boolean | null;
}

/** 后端会话配置（POST/PUT /chat/sessions） */
export interface RemoteChatSession {
  conversationId: string;
  title: string;
  vendor?: string | null;
  modelCode?: string | null;
  docIds?: number[] | null;
  compressEnabled?: boolean | null;
  createdAt?: number;
  updatedAt?: number;
}

/** 后端会话消息项 */
interface RemoteMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

/** 生成唯一ID（新会话先在前端之前创建，首次发消息后才会落库） */
function generateId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取会话列表（后端真实数据，按最近活动倒序） */
export async function getConversations(): Promise<Conversation[]> {
  const list = await http.get<RemoteConversation[]>('/chat/conversations');
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    id: item.id,
    title: item.title || '新对话',
    lastMessage: item.lastMessage ?? '',
    // 消息按需加载，避免列表页一次性拉全量
    messages: [],
    knowledgeBaseId: null,
    knowledgeDocIds: item.knowledgeDocIds ?? [],
    vendor: item.vendor ?? undefined,
    modelCode: item.modelCode ?? undefined,
    compressEnabled: item.compressEnabled !== false,
    createdAt: item.createdAt ?? Date.now(),
    updatedAt: item.updatedAt ?? Date.now(),
  }));
}

/** 获取某会话的历史消息（刷新页面 / 切换会话时回显） */
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const list = await http.get<RemoteMessage[]>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`
  );
  if (!Array.isArray(list)) return [];
  return list.map((m) => ({
    id: `msg-${m.id}`,
    role: m.role,
    content: m.content,
    timestamp: m.createdAt ?? Date.now(),
  }));
}

/** 创建新会话：id 由前端生成，同时写入 chat_session 持久化会话级配置 */
export async function createConversation(
  title: string,
  model?: { vendor?: string; modelCode?: string; modelName?: string },
  docIds?: number[],
  compressEnabled = true
): Promise<Conversation> {
  const now = Date.now();
  const id = generateId();
  const conversation: Conversation = {
    id,
    title,
    lastMessage: '',
    messages: [],
    knowledgeBaseId: null,
    knowledgeDocIds: docIds ?? [],
    compressEnabled,
    ...model,
    createdAt: now,
    updatedAt: now,
  };
  await http.post<RemoteChatSession>('/chat/sessions', {
    conversationId: id,
    title,
    vendor: model?.vendor,
    modelCode: model?.modelCode,
    docIds: docIds && docIds.length > 0 ? docIds : undefined,
    compressEnabled,
  });
  return conversation;
}

/** 更新会话配置（模型 / 标题 / 文档集合 / 压缩开关；null 字段不修改） */
export async function updateConversation(
  id: string,
  patch: {
    title?: string;
    vendor?: string;
    modelCode?: string;
    docIds?: number[];
    compressEnabled?: boolean;
  }
): Promise<RemoteChatSession> {
  return http.put<RemoteChatSession>(`/chat/sessions/${encodeURIComponent(id)}`, patch);
}

/** 删除会话（清空后端该会话记忆行） */
export async function deleteConversation(id: string): Promise<void> {
  await http.del<boolean>(`/chat/conversations/${encodeURIComponent(id)}`);
}

/** 发送消息到指定模型，返回 AI 回复文本（真实后端同步调用）。
 *  @param conversationId 当前会话 id，后端用它做会话隔离与记忆 */
export async function sendMessage(
  content: string,
  vendor: string,
  modelCode: string,
  conversationId?: string | null,
  compressEnabled = true
): Promise<string> {
  const reply = await http.post<string>('/chat/message', {
    message: content,
    vendor,
    modelCode,
    conversationId,
    compressEnabled,
  });
  return reply;
}

export interface StreamChatMessageOptions {
  message: string;
  vendor: string;
  modelCode: string;
  conversationId?: string | null;
  /** 本次对话绑定的知识库文档 id；非空时由后端检索并注入上下文，引用随 SSE 下发 */
  docIds?: number[];
  /** 是否开启上下文自动压缩（会话级配置） */
  compressEnabled?: boolean;
  /** 后端产出的引用片段（event: references 到达时触发一次） */
  onReferences?: (references: RetrieveChunk[]) => void;
  /** 增量文本回调（每到达一个 token 触发一次） */
  onDelta: (text: string) => void;
  /** 完成回调（收到 [DONE] 或流自然结束） */
  onDone?: () => void;
  /** 错误回调（非中断错误） */
  onError?: (e: Error) => void;
}

/**
 * 流式对话（SSE）：POST /chat/stream，fetch + ReadableStream 解析。
 * 后端事件：先 event: references（引用数组 JSON），后 data: <token>，末尾 data: [DONE]。
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
          docIds: o.docIds && o.docIds.length > 0 ? o.docIds : undefined,
          compressEnabled: o.compressEnabled !== false,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`流式请求失败 (${resp.status})`);
      }
      // 参数校验/业务异常可能以 JSON 返回（非 SSE）：解析 message 交给 onError，避免被当成空回复
      const contentType = resp.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        const body = (await resp.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || '流式请求失败');
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
          if (eventName === 'references') {
            try {
              const refs = JSON.parse(text) as RetrieveChunk[];
              if (Array.isArray(refs)) o.onReferences?.(refs);
            } catch {
              // 引用解析失败不影响正文流
            }
            continue;
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
