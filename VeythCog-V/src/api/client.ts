/**
 * HTTP 客户端封装
 * - 统一 baseURL（config.apiBase）
 * - 自动带 token（从 authStore 读取，单一权威来源）
 * - 统一错误格式：后端 { code, data, message } 解包，code!==0 抛 ApiError
 * - 401：清登录态并跳 /login
 */

import { config, MOCK_TOKEN } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { useModeStore } from '@/stores/modeStore';

export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** 自定义 headers */
  headers?: Record<string, string>;
  /** 超时 ms */
  timeout?: number;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // 联调模式下允许从 modeStore 覆盖后端地址（登录页可改），否则用 env 默认
  const base = useModeStore.getState().apiBase || config.apiBase;
  const url = path.startsWith('http') ? path : base + path;
  if (!query) return url;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

function getToken(): string | null {
  // 单一权威来源：authStore（zustand persist，登录时写入、刷新后同步恢复）
  return useAuthStore.getState().token;
}

/**
 * 拼出可直接给 <img src> / <a href> 用的接口地址。
 * 这类请求由浏览器直连、拿不到 Authorization，只用于已放行的静态资源接口（如壁纸缩略图）。
 */
export function apiUrl(path: string, query?: Record<string, string | number | undefined>): string {
  return buildUrl(path, query);
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, headers = {}, timeout = 30000 } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(buildUrl(path, query), {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // 401：token 失效，清掉并跳登录
    if (resp.status === 401) {
      // 本地绕过模式（dev-bypass-token）下后端未部署，任何 401 都是预期，不清登录态、不踢回登录页
      const bypass = useModeStore.getState().bypassMode;
      if (!(bypass && getToken() === MOCK_TOKEN)) {
        useAuthStore.getState().logout();
        // 纯函数模块不能用 react-router，直接整页跳登录
        if (!location.pathname.startsWith('/login')) {
          location.href = '/login';
        }
      }
      throw new ApiError(401, '未登录或登录已过期');
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new ApiError(resp.status, `请求失败 (${resp.status})`, text);
    }

    // 204 / 空响应
    if (resp.status === 204) return undefined as T;

    const ct = resp.headers.get('content-type') ?? '';

    // 后端未部署时，静态托管（如 EdgeOne）会把 /api/* 的请求 SPA fallback 成 index.html（200 text/html）。
    // 这种情况绝不能把 HTML 字符串当业务数据返回，否则调用方 .map/.some 直接崩。
    if (ct.includes('text/html')) {
      throw new ApiError(502, '后端服务未部署或路由未配置（收到 HTML 响应）', await resp.text().catch(() => ''));
    }

    if (ct.includes('application/json')) {
      const body = await resp.json();
      // 后端统一 { code, data, message } 解包：code===0 返回 data，否则抛业务错误
      if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'number') {
        const b = body as { code: number; data: T; message: string };
        if (b.code === 0) return b.data;
        throw new ApiError(resp.status, b.message ?? '请求失败', b);
      }
      return body as T;
    }
    return (await resp.text()) as unknown as T;
  } finally {
    clearTimeout(timer);
  }
}

export const http = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
};
