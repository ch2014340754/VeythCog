/**
 * 系统管理 · 模型目录 API（真实接口，走 /admin/llm-models）
 * - 列出全部模型（含未上架）
 * - 新增 / 编辑 / 删除 / 上下架
 * - 从供应商同步（只增不删，新增默认不上架）
 */
import { http } from '@/api/client';

export interface AdminLlmModel {
  id: number;
  vendor: string;
  vendorName: string;
  modelCode: string;
  modelName: string;
  maxContextTokens: number;
  temperature: number;
  enabled: boolean;
  bindingCount: number;
}

export interface ModelVendorOption {
  vendor: string;
  vendorName: string;
}

export interface AdminModelPayload {
  vendor: string;
  modelCode: string;
  modelName?: string;
  maxContextTokens?: number;
  temperature?: number;
  enabled?: boolean;
}

export interface ModelSyncResult {
  vendor: string;
  vendorName: string;
  total: number;
  added: number;
  skipped: number;
  addedCodes: string[];
  message: string;
}

/** 全部模型（含未上架） */
export async function listAdminModels(): Promise<AdminLlmModel[]> {
  return http.get<AdminLlmModel[]>('/admin/llm-models');
}

/** 供应商选项（后端固定枚举） */
export async function listModelVendors(): Promise<ModelVendorOption[]> {
  return http.get<ModelVendorOption[]>('/admin/llm-models/vendors');
}

/** 新增模型 */
export async function createAdminModel(payload: AdminModelPayload): Promise<AdminLlmModel> {
  return http.post<AdminLlmModel>('/admin/llm-models', payload);
}

/** 编辑模型 */
export async function updateAdminModel(id: number, payload: AdminModelPayload): Promise<AdminLlmModel> {
  return http.put<AdminLlmModel>(`/admin/llm-models/${id}`, payload);
}

/** 删除模型（仍有用户绑定会被后端拒绝） */
export async function deleteAdminModel(id: number): Promise<boolean> {
  return http.del<boolean>(`/admin/llm-models/${id}`);
}

/** 上架 / 下架 */
export async function setAdminModelEnabled(id: number, enabled: boolean): Promise<AdminLlmModel> {
  return http.put<AdminLlmModel>(`/admin/llm-models/${id}/enabled`, { enabled });
}

/** 从供应商同步（vendor 侧需有可用 AK） */
export async function syncVendorModels(vendor: string, enableNew = false): Promise<ModelSyncResult> {
  return http.post<ModelSyncResult>('/admin/llm-models/sync', { vendor, enableNew });
}
