/**
 * 知识库 API（对接后端 P0 契约，见 openspec/api-spec.md）
 * - 文档 CRUD / 导入导出 / 向量化 / RAG 召回
 * - 统一走 http 客户端（自动带 token、解包 { code, data, message }）
 */
import type {
  DocDetail,
  DocListItem,
  DocSavePayload,
  KnowledgeTree,
  PageResult,
  RetrieveChunk,
} from '@/types';
import { http, ApiError } from '@/api/client';
import { config } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { useModeStore } from '@/stores/modeStore';

/** 与 http 客户端保持一致的后端地址解析（联调模式可覆盖） */
function apiBase(): string {
  return useModeStore.getState().apiBase || config.apiBase;
}

export interface ListDocsParams {
  keyword?: string;
  tag?: string;
  sortField?: 'createdAt' | 'title' | 'updatedAt';
  sortOrder?: 'ascend' | 'descend';
  current?: number;
  pageSize?: number;
}

/** 1. 文档列表 */
export function listDocs(params: ListDocsParams): Promise<PageResult<DocListItem>> {
  const query: Record<string, string | number | undefined> = {
    keyword: params.keyword,
    tag: params.tag,
    sortField: params.sortField,
    sortOrder: params.sortOrder,
    current: params.current,
    pageSize: params.pageSize,
  };
  return http.get<PageResult<DocListItem>>('/knowledge/list', query);
}

/** 2. 文档详情 */
export function getDoc(docId: number): Promise<DocDetail> {
  return http.get<DocDetail>(`/knowledge/doc/${docId}`);
}

/** 3. 新建文档 */
export function createDoc(payload: DocSavePayload): Promise<number> {
  return http.post<number>('/knowledge/doc', payload);
}

/** 4. 更新文档 */
export function updateDoc(docId: number, payload: DocSavePayload): Promise<void> {
  return http.put<void>(`/knowledge/doc/${docId}`, payload);
}

/** 5. 删除文档（软删除） */
export function deleteDoc(docId: number): Promise<void> {
  return http.del<void>(`/knowledge/doc/${docId}`);
}

/** 6. 导入 Markdown（multipart/form-data，仅 .md，≤500KB） */
export async function importMd(
  file: File,
  title?: string,
  tags?: string[]
): Promise<number> {
  const fd = new FormData();
  fd.append('file', file);
  if (title) fd.append('title', title);
  if (tags && tags.length > 0) fd.append('tags', tags.join(','));

  const token = useAuthStore.getState().token;
  const resp = await fetch(`${apiBase()}/knowledge/import/md`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new ApiError(resp.status, `导入失败 (${resp.status})`, text);
  }
  const body = await resp.json();
  if (body && typeof body.code === 'number') {
    if (body.code === 0) return body.data as number;
    throw new ApiError(resp.status, body.message ?? '导入失败', body);
  }
  return body as number;
}

/** 7. 导出 Markdown（触发浏览器下载） */
export async function exportMd(docId: number): Promise<void> {
  const token = useAuthStore.getState().token;
  const resp = await fetch(`${apiBase()}/knowledge/doc/${docId}/export/md`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new ApiError(resp.status, `导出失败 (${resp.status})`, text);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `doc-${docId}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 向量化结果：分片数 + 本次自动补齐的元数据（仅填空值，可能为 null） */
export interface VectorizeResult {
  chunkCount: number;
  summary: string | null;
  tags: string[] | null;
}

/** 8. 向量化（后端同时按需自动生成摘要/标签） */
export function vectorize(docId: number): Promise<VectorizeResult> {
  return http.post<VectorizeResult>(`/knowledge/doc/${docId}/vectorize`);
}

/** 8.1 显式重新生成摘要 / 标签（覆盖已有内容） */
export function regenerateMetadata(docId: number): Promise<{ summary: string; tags: string[] }> {
  return http.post<{ summary: string; tags: string[] }>(`/knowledge/doc/${docId}/metadata/regenerate`);
}

/** 9. 取消向量化 */
export function unvectorize(docId: number): Promise<void> {
  return http.post<void>(`/knowledge/doc/${docId}/unvectorize`);
}

/** 10. RAG 召回 */
export function retrieve(payload: {
  docIds: number[];
  query: string;
  topN?: number;
}): Promise<RetrieveChunk[]> {
  return http.post<RetrieveChunk[]>('/knowledge/rag/retrieve', payload);
}

/* ==================== 目录树（P1） ==================== */

/** 11. 知识树：目录 + 文档扁平返回；keyword 非空时只返回命中文档及其祖先目录 */
export function getTree(params?: { keyword?: string }): Promise<KnowledgeTree> {
  return http.get<KnowledgeTree>('/knowledge/tree', {
    keyword: params?.keyword?.trim() || undefined,
  });
}

/** 12. 新建目录（parentId 为空 = 根级） */
export function createFolder(parentId: number | null, name: string): Promise<number> {
  return http.post<number>('/knowledge/folder', { parentId, name });
}

/** 13. 重命名目录 */
export function renameFolder(folderId: number, name: string): Promise<void> {
  return http.put<void>(`/knowledge/folder/${folderId}`, { name });
}

/** 14. 删除目录；recursive=true 时级联删除子目录与文档（含向量清理） */
export function deleteFolder(folderId: number, recursive = false): Promise<void> {
  return http.del<void>(`/knowledge/folder/${folderId}?recursive=${recursive ? 'true' : 'false'}`);
}

/** 15. 目录影响范围统计（删除二次确认用） */
export function getFolderStats(folderId: number): Promise<{ docCount: number; folderCount: number }> {
  return http.get<{ docCount: number; folderCount: number }>(`/knowledge/folder/${folderId}/stats`);
}

/** 16. 移动目录（parentId 为空 = 移到根级） */
export function moveFolder(folderId: number, parentId: number | null): Promise<void> {
  return http.post<void>(`/knowledge/folder/${folderId}/move`, { parentId });
}

/** 17. 移动文档（folderId 为空 = 移到根级；只改归属，不废向量） */
export function moveDoc(docId: number, folderId: number | null): Promise<void> {
  return http.post<void>(`/knowledge/doc/${docId}/move`, { folderId });
}

/** 18. 重命名文档（只改标题，不动正文、不废向量） */
export function renameDoc(docId: number, title: string): Promise<void> {
  return http.put<void>(`/knowledge/doc/${docId}/title`, { title });
}

/** 19. 批量导出：勾选文档 / 目录（含子目录） / 全库 → zip 下载；都不传 = 全部文档 */
export async function exportZip(
  folderId: number | null,
  docIds?: number[],
  fileName = 'knowledge.zip'
): Promise<void> {
  const token = useAuthStore.getState().token;
  const params: string[] = [];
  if (folderId != null) params.push(`folderId=${folderId}`);
  if (docIds && docIds.length > 0) params.push(`docIds=${docIds.join(',')}`);
  const query = params.length > 0 ? `?${params.join('&')}` : '';
  const resp = await fetch(`${apiBase()}/knowledge/export/zip${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new ApiError(resp.status, `导出失败 (${resp.status})`, text);
  }
  // 后端业务错误也是 HTTP 200 + JSON（code != 0），必须先识别，否则会把错误体当成 zip 下载
  const contentType = resp.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await resp.json().catch(() => null);
    throw new ApiError(resp.status, body?.message ?? '导出失败', body);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
