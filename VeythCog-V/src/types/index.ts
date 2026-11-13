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
  /** RAG 召回片段（用户消息携带，用于渲染引用卡片） */
  references?: RetrieveChunk[];
}

// 对话
export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  messages: Message[];
  knowledgeBaseId: string | null;
  /** 会话选中的知识库文档 id 列表（RAG 召回范围） */
  knowledgeDocIds?: number[];
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
  /** 角色：管理员 / 普通用户 */
  role?: 'admin' | 'user';
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
  /** 当前用户是否已配置自持 AK */
  hasApiKey: boolean;
  /** 用户 AK 脱敏值（未配置为 null） */
  apiKeyMasked: string | null;
  /** 配置文件是否配置了兜底 AK */
  hasFallbackKey: boolean;
}

/** 后端统一响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

// ============ 系统管理（管理员） ============

/** 管理员视角的用户列表项 */
export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  createdAt: number;
  lastLoginAt?: number;
  /** 统计 */
  conversationCount: number;
  kbDocumentCount: number;
}

/** 供应商目录项（管理员控制可见性） */
export interface AdminVendor {
  vendor: string;
  vendorName: string;
  baseUrl: string;
  /** 该供应商下模型是否对用户可见 */
  visible: boolean;
  models: AdminVendorModel[];
}

export interface AdminVendorModel {
  modelCode: string;
  modelName: string;
  /** 该模型是否对用户可见 */
  visible: boolean;
  /** 是否为新用户默认模型 */
  isDefault: boolean;
}

/** 调用统计日项 */
export interface CallStatDay {
  date: string;
  /** 调用次数 */
  calls: number;
  /** token 消耗 */
  tokens: number;
}

/** 在线会话 */
export interface OnlineSession {
  sessionId: string;
  username: string;
  name: string;
  ip: string;
  loginAt: number;
  lastActiveAt: number;
}

/** 错误日志 */
export interface ErrorLog {
  id: string;
  time: number;
  level: 'error' | 'warn';
  source: string;
  message: string;
}

/** 审计日志 */
export interface AuditLogEntry {
  id: string;
  time: number;
  username: string;
  action: string;
  detail: string;
  ip: string;
}

/** 系统配置 */
export interface SystemConfig {
  /** 是否允许自助注册 */
  allowRegister: boolean;
  /** 系统公告 */
  announcement: string;
  /** 新用户默认主题 */
  defaultPreset: PresetName;
  /** 新用户默认模型 vendor */
  defaultVendor: string;
  /** 新用户默认模型 code */
  defaultModelCode: string;
}

/** 定时任务 */
export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cron: string;
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  lastStatus: 'success' | 'failed' | 'never';
}

// ============ 知识库（后端 P0 契约） ============

/** 块结构（block_data 内的单个块，P0 以 markdown 为主，块结构预留） */
export interface Block {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: string | unknown[];
  level?: number;
}

/** 文档列表项 */
export interface DocListItem {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  isVectorized: boolean;
  updatedAt: number;
}

/** 文档详情 */
export interface DocDetail {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  /** 块结构数组（JSON 字符串，权威源） */
  blockData: string;
  /** 派生 Markdown 缓存 */
  markdownText: string;
  isVectorized: boolean;
  createdAt: number;
  updatedAt: number;
}

/** RAG 召回片段 */
export interface RetrieveChunk {
  chunkText: string;
  docId: number;
  title: string;
  /** 文档内分片序号（从 0 起），用于引用溯源 */
  chunkIndex: number;
  /** L2 距离，越小越相似 */
  score: number;
}

/** 分页返回结构 */
export interface PageResult<T> {
  records: T[];
  total: number;
  current: number;
  pageSize: number;
}

/** 新建 / 更新文档请求体 */
export interface DocSavePayload {
  title: string;
  summary?: string;
  tags?: string[];
  blockData?: string;
  markdownText?: string;
}
