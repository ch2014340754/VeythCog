/**
 * 多模型管理 API（对接后端 vc-llm / vc-app）
 * - 查询我的绑定模型
 * - 查询供应商枚举 + 模型目录（含用户 AK 状态）
 * - 批量绑定（供应商 → 多选模型 + 可选新 AK + 默认模型）
 * - 编辑 / 清除用户自持 AK
 */
import { http } from '@/api/client';
import type { LlmModelItem, CatalogVendorItem } from '@/types';

/** 我的绑定模型列表（GET /llm/models） */
export async function getModels(): Promise<LlmModelItem[]> {
  return http.get<LlmModelItem[]>('/llm/models');
}

/** 供应商枚举 + 模型目录（GET /llm/catalog） */
export async function getCatalog(): Promise<CatalogVendorItem[]> {
  return http.get<CatalogVendorItem[]>('/llm/catalog');
}

/** 绑定模型（POST /llm/bindings，兼容旧调用） */
export async function bindModel(
  vendor: string,
  modelCode: string,
  isDefault?: boolean
): Promise<void> {
  return http.post('/llm/bindings', { vendor, modelCode, isDefault });
}

/** 解绑模型（DELETE /llm/bindings/{vendor}/{modelCode}） */
export async function unbindModel(vendor: string, modelCode: string): Promise<void> {
  return http.del(`/llm/bindings/${vendor}/${modelCode}`);
}

/** 设为默认模型（PUT /llm/bindings/{vendor}/{modelCode}/default） */
export async function setDefaultModel(vendor: string, modelCode: string): Promise<void> {
  return http.put(`/llm/bindings/${vendor}/${modelCode}/default`);
}

/** 批量绑定请求 */
export interface BatchBindPayload {
  vendor: string;
  modelCodes: string[];
  /** 新 AK；留空表示不修改已保存的 Key */
  apiKey?: string;
  /** 默认模型，必须来自 modelCodes */
  defaultModelCode?: string;
  /** 业务空间 ID；空串表示清除用户设置、回落系统配置；不传表示不修改 */
  workspaceId?: string;
  /** 地域代码；空串表示清除用户设置、回落系统配置；不传表示不修改 */
  region?: string;
}

/** 批量绑定结果 */
export interface BatchBindResult {
  vendor: string;
  modelCodes: string[];
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}

/** 供应商 Key 状态（不含明文） */
export interface VendorKeyStatus {
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  hasFallbackKey: boolean;
}

/** 批量绑定（POST /llm/bindings/batch） */
export async function batchBindModels(payload: BatchBindPayload): Promise<BatchBindResult> {
  return http.post<BatchBindResult>('/llm/bindings/batch', payload);
}

/** 编辑某供应商的用户 AK（PUT /llm/vendors/{vendor}/api-key） */
export async function updateVendorKey(vendor: string, apiKey: string): Promise<VendorKeyStatus> {
  return http.put<VendorKeyStatus>(`/llm/vendors/${vendor}/api-key`, { apiKey });
}

/** 清除某供应商的用户 AK，回落系统兜底（DELETE /llm/vendors/{vendor}/api-key） */
export async function clearVendorKey(vendor: string): Promise<VendorKeyStatus> {
  return http.del<VendorKeyStatus>(`/llm/vendors/${vendor}/api-key`);
}

/** 模型连通校验结果 */
export interface VerifyResult {
  /** 是否通过；通过后才会出现在对话模型下拉 */
  valid: boolean;
  message: string;
  latencyMs: number;
  verifiedAt: number;
}

/** 单模型连通校验（不要求已绑定；apiKey / workspaceId / region 均为草稿值，可不传） */
export async function verifyModel(
  vendor: string,
  modelCode: string,
  apiKey?: string,
  workspaceId?: string,
  region?: string
): Promise<VerifyResult> {
  const body: Record<string, string> = {};
  if (apiKey) {
    body.apiKey = apiKey;
  }
  if (workspaceId) {
    body.workspaceId = workspaceId;
  }
  if (region) {
    body.region = region;
  }
  return http.post<VerifyResult>(
    `/llm/models/${encodeURIComponent(vendor)}/${encodeURIComponent(modelCode)}/verify`,
    body
  );
}

/** 兼容旧命名 */
export const verifyBinding = verifyModel;
