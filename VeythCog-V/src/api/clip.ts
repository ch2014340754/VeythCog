/**
 * 网页剪藏 + 收件箱 API
 * - 粘链接剪藏：POST /clip/url（服务端抓取）
 * - 收件箱：列表 / 详情 / 编辑 / 丢弃 / 删除 / 入库
 * - 剪藏令牌：签发（只在这一次响应里有明文与书签脚本）/ 列表 / 撤销
 */
import { http } from '@/api/client';
import { config } from '@/config';
import { useModeStore } from '@/stores/modeStore';
import type { PageResult } from '@/types';

export type ClipStatus = 'pending' | 'archived' | 'dropped';

export interface ClipItemView {
  id: number;
  url: string;
  site: string;
  title: string;
  byline: string;
  excerpt: string;
  wordCount: number;
  /** ok = readability 提取成功；fallback = 回退整页文本 */
  quality: 'ok' | 'fallback';
  channel: 'url' | 'bookmarklet';
  status: ClipStatus;
  /** 非空表示这次抓取失败的原因（记录仍留在收件箱，便于重试） */
  error: string;
  tags: string[];
  docId?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
}

export interface ClipItemDetail extends ClipItemView {
  contentMd: string;
  rawHtml?: string | null;
}

export interface ClipImportResult {
  clipId: number;
  docId: number;
  vectorized: boolean;
  chunkCount: number;
  error?: string;
  alreadyImported?: boolean;
}

export interface ClipTokenView {
  id: number;
  label: string;
  revoked: boolean;
  createdAt?: number | null;
  lastUsedAt?: number | null;
}

export interface ClipTokenCreateResult {
  id: number;
  label: string;
  /** 明文令牌，只返回一次 */
  token: string;
  /** 已拼好令牌的 javascript: 书签链接 */
  bookmarklet: string;
  createdAt: number;
}

export function clipByUrl(url: string): Promise<ClipItemView> {
  return http.post<ClipItemView>('/clip/url', { url });
}

export function listClipItems(params: {
  status?: string;
  keyword?: string;
  current?: number;
  pageSize?: number;
}): Promise<PageResult<ClipItemView>> {
  return http.get<PageResult<ClipItemView>>('/clip/items', {
    status: params.status,
    keyword: params.keyword,
    current: params.current ?? 1,
    pageSize: params.pageSize ?? 20,
  });
}

export function getClipItem(id: number): Promise<ClipItemDetail> {
  return http.get<ClipItemDetail>(`/clip/items/${id}`);
}

export function updateClipItem(
  id: number,
  patch: {
    title?: string;
    tags?: string[];
    contentMd?: string;
    status?: 'pending' | 'dropped';
    clearRawHtml?: boolean;
  },
): Promise<ClipItemView> {
  return http.put<ClipItemView>(`/clip/items/${id}`, patch);
}

export function deleteClipItem(id: number): Promise<void> {
  return http.del<void>(`/clip/items/${id}`);
}

export function clipToKnowledge(
  id: number,
  payload?: { title?: string; tags?: string[]; folderId?: number | null; vectorize?: boolean },
): Promise<ClipImportResult> {
  return http.post<ClipImportResult>(`/clip/items/${id}/to-knowledge`, payload ?? {});
}

export function getClipPendingCount(): Promise<number> {
  return http.get<number>('/clip/pending-count');
}

export function listClipTokens(): Promise<ClipTokenView[]> {
  return http.get<ClipTokenView[]>('/clip/tokens');
}

/** 当前后端地址：生成书签脚本时可以显式指定，本地开发才能指向 localhost */
export function currentApiBase(): string {
  return useModeStore.getState().apiBase || config.apiBase;
}

export function createClipToken(label: string, apiBase = currentApiBase()): Promise<ClipTokenCreateResult> {
  return http.post<ClipTokenCreateResult>('/clip/tokens', { label, apiBase });
}

export function revokeClipToken(id: number): Promise<void> {
  return http.del<void>(`/clip/tokens/${id}`);
}
