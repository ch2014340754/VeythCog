/**
 * 对话 store
 * 当前页面用 mock 数据，后端对接时把 fetchConversations 等函数里的 mock 分支换成 http.get/post 即可
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation, Message } from '@/types';

interface ChatState {
  conversations: Conversation[];
  currentId: string | null;
  /** 正在流式输出的消息 id */
  streamingId: string | null;

  setConversations: (list: Conversation[]) => void;
  setCurrent: (id: string | null) => void;
  addConversation: (c: Conversation) => void;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  appendMessage: (convId: string, msg: Message) => void;
  appendDelta: (convId: string, msgId: string, delta: string) => void;
  setStreaming: (id: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      currentId: null,
      streamingId: null,

      setConversations: (list) => set({ conversations: list }),
      setCurrent: (id) => set({ currentId: id }),
      addConversation: (c) => set((s) => ({ conversations: [c, ...s.conversations] })),
      updateConversation: (id, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          currentId: s.currentId === id ? null : s.currentId,
        })),
      appendMessage: (convId, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, msg], lastMessage: msg.content, updatedAt: msg.timestamp }
              : c
          ),
        })),
      appendDelta: (convId, msgId, delta) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + delta } : m
                  ),
                  lastMessage: c.messages[c.messages.length - 1]?.content ?? '',
                }
              : c
          ),
        })),
      setStreaming: (id) => set({ streamingId: id }),
    }),
    { name: 'mywork:chat' }
  )
);
