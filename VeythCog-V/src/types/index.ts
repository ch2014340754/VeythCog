// 预设主题名称
export type PresetName = 'amethyst' | 'amber' | 'emerald' | 'indigo' | 'rose' | 'slate';

// 外观模式
export type AppearanceMode = 'light' | 'dark' | 'system';

// 配色预设
// 说明：secondary 在亮模式下作为浅背景/底纹色，在暗模式下作为边框/弱化背景色，
// 不要把它同时当文字色和背景色用。surface/surfaceElevated/surfaceOverlay 仅在暗色模式下由 preset 提供。
export interface ColorPreset {
  name: PresetName;
  label: string;
  primary: string;
  secondary: string;
  cta: string;
  accent: string;
  bg: string;
  text: string;
  border: string;
  /** 暗色模式下的卡片/容器表面色（亮色统一用 #ffffff） */
  surface?: string;
  /** 暗色模式下的抬升表面（弹层、输入框） */
  surfaceElevated?: string;
  /** 暗色模式下的遮罩/毛玻璃底色 */
  surfaceOverlay?: string;
}

// 主题配置
export interface ThemeConfig {
  preset: PresetName;
  mode: AppearanceMode;
}

// 消息
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// 对话
export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  messages: Message[];
  knowledgeBaseId: string | null;
  /** 会话绑定的模型（vendor:modelCode） */
  vendor?: string;
  modelCode?: string;
  modelName?: string;
  createdAt: number;
  updatedAt: number;
}

// 文档状态
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 知识库文档
export interface KnowledgeDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'md' | 'txt' | 'csv';
  size: string;
  status: DocumentStatus;
  segmentCount: number;
  createdAt: number;
}

// 知识库
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  segmentCount: number;
  totalSize: string;
  coverColor: string;
  documents: KnowledgeDocument[];
  createdAt: number;
  updatedAt: number;
}

// ============ 多模型对话 ============

/** 模型配置（用户可配置多个模型，切换使用） */
export interface ModelConfig {
  id: string;
  /** 显示名，如 "GPT-4o" */
  label: string;
  /** 实际调用的 model 名，如 "gpt-4o" */
  model: string;
  /** API base 覆盖，不填用全局 VITE_LLM_BASE */
  baseUrl?: string;
  /** API key（本地存，仅前端 demo 阶段；生产应走后端代理） */
  apiKey?: string;
  /** 支持的特性 */
  capabilities?: ('vision' | 'function_call' | 'stream')[];
  /** 是否启用 */
  enabled: boolean;
}

// ============ 数据库可视化 ============

/** 数据库连接配置 */
export interface DBConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite' | 'clickhouse';
  host: string;
  port: number;
  database: string;
  username: string;
  createdAt: number;
}

/** SQL 查询结果 */
export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  durationMs: number;
}

// ============ 笔记 ============

export interface Note {
  id: string;
  title: string;
  content: string;
  /** 来源：本地 / 飞书 */
  source: 'local' | 'lark';
  /** 飞书文档 token（若来自飞书） */
  larkDocToken?: string;
  createdAt: number;
  updatedAt: number;
}

// ============ 工具标签页 ============

export interface ToolTab {
  /** 工具 id（对应 registry） */
  id: string;
  /** 工具名 */
  name: string;
  openedAt: number;
}

// ============ 账号 / 用户 ============

/** 当前登录用户（mock 阶段为本地档案，后期对接后端） */
export interface User {
  id: string;
  /** 显示名 */
  name: string;
  /** 邮箱（可选） */
  email?: string;
  /** 头像 URL（可选，没有就用首字母 fallback） */
  avatar?: string;
}

/** 飞书账号绑定状态 */
export interface LarkBinding {
  bound: boolean;
  /** 飞书 open_id / union_id */
  openId?: string;
  /** 飞书显示名 */
  name?: string;
  /** 飞书头像 */
  avatar?: string;
  /** 绑定时间戳 */
  boundAt?: number;
}

// ============ 大模型供应商（baseUrl + apiKey 分组） ============

/** 供应商下挂的单个模型 */
export interface LlmModel {
  id: string;
  /** 显示名，如 "GPT-4o" */
  label: string;
  /** 实际调用的 model 名，如 "gpt-4o" */
  model: string;
  /** 支持的特性 */
  capabilities?: ('vision' | 'function_call' | 'stream')[];
  /** 是否启用 */
  enabled: boolean;
}

/** 大模型供应商：一组 baseUrl + apiKey，下面挂多个模型 */
export interface LlmProvider {
  id: string;
  /** 显示名，如 "OpenAI" / "DeepSeek" / "自定义" */
  name: string;
  /** API base，如 https://api.openai.com/v1 */
  baseUrl: string;
  /** API Key（demo 阶段存 localStorage，后期入数据库） */
  apiKey: string;
  /** 该供应商下的模型列表 */
  models: LlmModel[];
}

// ============ 后端多模型（供应商枚举 + 用户绑定） ============

/** 用户已绑定的模型（GET /llm/models） */
export interface LlmModelItem {
  /** 供应商编码：dashscope / deepseek */
  vendor: string;
  /** 模型编码：qwen-plus / deepseek-chat */
  modelCode: string;
  /** 显示名 */
  modelName: string;
  /** 是否可用 */
  enabled: boolean;
  /** 是否默认模型 */
  isDefault: boolean;
}

/** 供应商目录下的模型（GET /llm/catalog） */
export interface CatalogModelItem {
  modelCode: string;
  modelName: string;
  /** 当前用户是否已绑定 */
  bound: boolean;
  isDefault: boolean;
  enabled: boolean;
}

/** 供应商枚举 + 其下模型目录 */
export interface CatalogVendorItem {
  vendor: string;
  vendorName: string;
  baseUrl: string;
  models: CatalogModelItem[];
}

/** 后端统一响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}