/**
 * 多模型管理 API（对接后端 vc-chat）
 * - 查询我的绑定模型
 * - 查询供应商枚举 + 模型目录
 * - 绑定 / 解绑 / 设为默认
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

/** 绑定模型（POST /llm/bindings） */
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
