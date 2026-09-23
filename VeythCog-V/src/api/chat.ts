/**
 * 对话 API
 * - 会话管理（本地 mock，P0 不做持久化）
 * - 发消息调后端真实模型接口 POST /chat/message
 */
import type { Conversation } from '@/types';
import { http } from '@/api/client';
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

/** 发送消息到指定模型，返回 AI 回复文本（真实后端同步调用） */
export async function sendMessage(
  content: string,
  vendor: string,
  modelCode: string
): Promise<string> {
  const reply = await http.post<string>('/chat/message', { message: content, vendor, modelCode });
  return reply;
}
