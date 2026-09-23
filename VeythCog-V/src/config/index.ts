/**
 * 全局配置读取层
 * 所有环境变量从这里统一导出，业务代码不要直接读 import.meta.env
 *
 * 后端对接时：
 * 1. 在 .env.local 填实际值（不提交）
 * 2. 把 VITE_USE_MOCK 改成 false
 * 3. client.ts / sse.ts 会自动走真实请求
 */

export const config = {
  /** 业务后端 API 地址 */
  apiBase: import.meta.env.VITE_API_BASE ?? 'http://localhost:8123/api',
  /** 大模型 API 地址（P0 由后端代理，前端不再直连） */
  llmBase: import.meta.env.VITE_LLM_BASE ?? '',
  /** 飞书 App ID */
  larkAppId: import.meta.env.VITE_LARK_APP_ID ?? '',
  /** 应用名 */
  appName: import.meta.env.VITE_APP_NAME ?? 'My Workspace',
  /** 是否 mock 模式（P0 已切真实后端） */
  useMock: (import.meta.env.VITE_USE_MOCK ?? 'false') === 'true',
} as const;
