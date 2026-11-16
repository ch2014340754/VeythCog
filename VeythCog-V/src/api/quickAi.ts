/**
 * 划词 AI API
 * - POST /ai/quick（SSE）：meta → references → data(token) → [DONE]
 * - GET /ai/quick/models：可用模型（结果卡里显示"由谁回答"）
 * - DELETE /ai/quick/cache：清后端缓存（"清空缓存"入口用）
 */
import { http } from '@/api/client';
import { streamSsePost, readTokenPayload } from '@/api/sseParse';
import type { RetrieveChunk } from '@/types';

export type QuickAiAction = 'explain' | 'translate' | 'polish' | 'ask';

export interface QuickAiMeta {
  modelName?: string;
  withKnowledge?: boolean;
  knowledgeAvailable?: boolean;
  knowledgeHit?: boolean;
  cached?: boolean;
  cachedAt?: number | null;
  action?: string;
}

export interface QuickAiOptions {
  action: QuickAiAction;
  text: string;
  pageTitle?: string;
  withKnowledge?: boolean;
  question?: string;
  /** true = 跳过两层缓存（"重新生成"） */
  nocache?: boolean;
  onMeta?: (meta: QuickAiMeta) => void;
  onReferences?: (refs: RetrieveChunk[]) => void;
  onDelta: (text: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/** 发起一次划词问答，返回可中断句柄 */
export function streamQuickAi(o: QuickAiOptions): AbortController {
  return streamSsePost(
    '/ai/quick',
    {
      action: o.action,
      text: o.text,
      pageTitle: o.pageTitle,
      withKnowledge: o.withKnowledge === true,
      question: o.question,
      nocache: o.nocache === true,
    },
    {
      onEvent: (event, data) => {
        if (event === 'meta') {
          try {
            o.onMeta?.(JSON.parse(data) as QuickAiMeta);
          } catch {
            // meta 解析失败不影响正文
          }
          return;
        }
        if (event === 'references') {
          try {
            const refs = JSON.parse(data) as RetrieveChunk[];
            if (Array.isArray(refs)) o.onReferences?.(refs);
          } catch {
            // 同上
          }
          return;
        }
        if (event === 'error') {
          o.onError?.(new Error(data || '模型调用失败'));
          return true;
        }
        const delta = readTokenPayload(data);
        if (delta) o.onDelta(delta);
      },
      onDone: o.onDone,
      onError: o.onError,
    },
  );
}

export interface QuickAiModel {
  modelName: string;
  modelCode: string;
  vendor: string;
}

export function listQuickAiModels(): Promise<QuickAiModel[]> {
  return http.get<QuickAiModel[]>('/ai/quick/models');
}

export function clearQuickAiCache(): Promise<void> {
  return http.del<void>('/ai/quick/cache');
}
