/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 基础地址 */
  readonly VITE_API_BASE: string;
  /** 大模型 API 基础地址（OpenAI 兼容协议） */
  readonly VITE_LLM_BASE: string;
  /** 飞书开放平台 App ID */
  readonly VITE_LARK_APP_ID?: string;
  /** 应用名称 */
  readonly VITE_APP_NAME: string;
  /** 是否启用 mock 模式 */
  readonly VITE_USE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
