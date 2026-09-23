import type { KnowledgeBase } from '@/types';
import { mockKnowledgeBases } from '@/mock/knowledge';

// 内存中的知识库数据副本（模拟数据库）
let knowledgeBases: KnowledgeBase[] = JSON.parse(JSON.stringify(mockKnowledgeBases));

/** 模拟异步延迟 */
function delay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 生成唯一ID */
function generateId(): string {
  return `kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取知识库列表 */
export async function getKnowledgeBases(): Promise<KnowledgeBase[]> {
  await delay();
  return [...knowledgeBases].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 获取单个知识库 */
export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | undefined> {
  await delay();
  return knowledgeBases.find((kb) => kb.id === id);
}

/** 创建知识库 */
export async function createKnowledgeBase(name: string, description: string): Promise<KnowledgeBase> {
  await delay();
  const now = Date.now();
  // 随机生成封面颜色
  const colors = ['#7C3AED', '#06B6D4', '#F59E0B', '#10B981', '#E11D48', '#475569'];
  const coverColor = colors[Math.floor(Math.random() * colors.length)];
  const newKB: KnowledgeBase = {
    id: generateId(),
    name,
    description,
    documentCount: 0,
    segmentCount: 0,
    totalSize: '0 MB',
    coverColor,
    documents: [],
    createdAt: now,
    updatedAt: now,
  };
  knowledgeBases = [newKB, ...knowledgeBases];
  return newKB;
}

/** 删除知识库 */
export async function deleteKnowledgeBase(id: string): Promise<void> {
  await delay();
  knowledgeBases = knowledgeBases.filter((kb) => kb.id !== id);
}