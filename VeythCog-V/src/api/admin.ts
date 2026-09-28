/**
 * 系统管理 API（mock 阶段，后端对接时替换为真实请求）
 *
 * 所有函数返回 Promise，用 setTimeout 模拟网络延迟。
 * 数据在模块内内存维护，刷新页面重置。
 */
import type {
  AdminUser,
  AdminVendor,
  CallStatDay,
  OnlineSession,
  ErrorLog,
  AuditLogEntry,
  SystemConfig,
  ScheduledTask,
} from '@/types';

// ---------- 内存数据 ----------

let mockUsers: AdminUser[] = [
  {
    id: 'u-1',
    username: 'admin',
    name: '管理员',
    email: 'admin@veythcog.dev',
    role: 'admin',
    status: 'active',
    createdAt: Date.now() - 90 * 86400_000,
    lastLoginAt: Date.now() - 3600_000,
    conversationCount: 128,
    kbDocumentCount: 45,
  },
  {
    id: 'u-2',
    username: 'chenjie',
    name: '陈杰',
    email: 'chenjie@veythcog.dev',
    role: 'user',
    status: 'active',
    createdAt: Date.now() - 45 * 86400_000,
    lastLoginAt: Date.now() - 7200_000,
    conversationCount: 56,
    kbDocumentCount: 12,
  },
  {
    id: 'u-3',
    username: 'zhangwei',
    name: '张伟',
    email: 'zhangwei@example.com',
    role: 'user',
    status: 'active',
    createdAt: Date.now() - 20 * 86400_000,
    lastLoginAt: Date.now() - 86400_000 * 3,
    conversationCount: 23,
    kbDocumentCount: 5,
  },
  {
    id: 'u-4',
    username: 'liming',
    name: '李明',
    email: 'liming@example.com',
    role: 'user',
    status: 'disabled',
    createdAt: Date.now() - 60 * 86400_000,
    lastLoginAt: Date.now() - 86400_000 * 15,
    conversationCount: 8,
    kbDocumentCount: 2,
  },
];

let mockVendors: AdminVendor[] = [
  {
    vendor: 'dashscope',
    vendorName: '阿里云 DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    visible: true,
    models: [
      { modelCode: 'qwen-plus', modelName: 'Qwen Plus', visible: true, isDefault: true },
      { modelCode: 'qwen-turbo', modelName: 'Qwen Turbo', visible: true, isDefault: false },
      { modelCode: 'qwen-max', modelName: 'Qwen Max', visible: false, isDefault: false },
    ],
  },
  {
    vendor: 'deepseek',
    vendorName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    visible: true,
    models: [
      { modelCode: 'deepseek-chat', modelName: 'DeepSeek V3', visible: true, isDefault: false },
      { modelCode: 'deepseek-reasoner', modelName: 'DeepSeek R1', visible: true, isDefault: false },
    ],
  },
  {
    vendor: 'openai',
    vendorName: 'OpenAI 兼容',
    baseUrl: 'https://api.openai.com/v1',
    visible: false,
    models: [
      { modelCode: 'gpt-4o', modelName: 'GPT-4o', visible: false, isDefault: false },
      { modelCode: 'gpt-4o-mini', modelName: 'GPT-4o Mini', visible: false, isDefault: false },
    ],
  },
];

// 生成最近 7 天调用量
function genCallStats(): CallStatDay[] {
  const days: CallStatDay[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      calls: Math.floor(80 + Math.random() * 120),
      tokens: Math.floor(20000 + Math.random() * 50000),
    });
  }
  return days;
}
let mockCallStats = genCallStats();

let mockOnlineSessions: OnlineSession[] = [
  {
    sessionId: 'sess-001',
    username: 'admin',
    name: '管理员',
    ip: '192.168.1.10',
    loginAt: Date.now() - 3600_000,
    lastActiveAt: Date.now() - 120_000,
  },
  {
    sessionId: 'sess-002',
    username: 'chenjie',
    name: '陈杰',
    ip: '192.168.1.25',
    loginAt: Date.now() - 7200_000,
    lastActiveAt: Date.now() - 600_000,
  },
];

let mockErrorLogs: ErrorLog[] = [
  { id: 'e-1', time: Date.now() - 1800_000, level: 'error', source: 'LLM Router', message: 'DeepSeek 调用超时（10s），已重试' },
  { id: 'e-2', time: Date.now() - 7200_000, level: 'warn', source: 'Knowledge', message: '文档 segment 数超过阈值 500，已截断' },
  { id: 'e-3', time: Date.now() - 86400_000 * 1.5, level: 'error', source: 'LLM Router', message: 'DashScope API Key 余额不足，请求被拒' },
  { id: 'e-4', time: Date.now() - 86400_000 * 2, level: 'warn', source: 'Auth', message: '用户 liming 连续 5 次密码错误' },
];

let mockAuditLogs: AuditLogEntry[] = [
  { id: 'a-1', time: Date.now() - 3600_000, username: 'admin', action: '登录', detail: '管理员登录系统', ip: '192.168.1.10' },
  { id: 'a-2', time: Date.now() - 7200_000, username: 'chenjie', action: '对话', detail: '发起新对话「React 性能优化」', ip: '192.168.1.25' },
  { id: 'a-3', time: Date.now() - 86400_000, username: 'admin', action: '模型配置', detail: '将 deepseek-reasoner 设为可见', ip: '192.168.1.10' },
  { id: 'a-4', time: Date.now() - 86400_000 * 1.2, username: 'zhangwei', action: '知识库', detail: '上传文档 API网关方案.pdf', ip: '10.0.0.5' },
  { id: 'a-5', time: Date.now() - 86400_000 * 2, username: 'admin', action: '用户管理', detail: '禁用用户 liming', ip: '192.168.1.10' },
  { id: 'a-6', time: Date.now() - 86400_000 * 2.5, username: 'system', action: '定时任务', detail: '过期对话清理：删除 12 条 90 天前会话', ip: '-' },
];

let mockSystemConfig: SystemConfig = {
  allowRegister: false,
  announcement: '',
  defaultPreset: 'amethyst',
  defaultVendor: 'dashscope',
  defaultModelCode: 'qwen-plus',
};

let mockTasks: ScheduledTask[] = [
  {
    id: 't-1',
    name: '过期对话清理',
    description: '自动删除超过 90 天未活跃的对话会话',
    cron: '0 3 * * *',
    enabled: true,
    lastRunAt: Date.now() - 86400_000,
    nextRunAt: Date.now() + 86400_000,
    lastStatus: 'success',
  },
  {
    id: 't-2',
    name: '过期日志清理',
    description: '自动清理超过 30 天的错误日志和审计日志',
    cron: '0 4 * * *',
    enabled: true,
    lastRunAt: Date.now() - 86400_000,
    nextRunAt: Date.now() + 86400_000,
    lastStatus: 'success',
  },
  {
    id: 't-3',
    name: '调用量统计快照',
    description: '每日将 LLM 调用量聚合写入 stat_daily 表',
    cron: '0 0 * * *',
    enabled: true,
    lastRunAt: Date.now() - 3600_000,
    nextRunAt: Date.now() + 82800_000,
    lastStatus: 'success',
  },
];

// ---------- 工具 ----------

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

// ---------- 用户管理 ----------

export async function getUsers(): Promise<AdminUser[]> {
  await delay();
  return [...mockUsers];
}

export async function createUser(input: {
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
  password: string;
}): Promise<AdminUser> {
  await delay();
  const newUser: AdminUser = {
    id: `u-${Date.now()}`,
    username: input.username,
    name: input.name,
    email: input.email,
    role: input.role,
    status: 'active',
    createdAt: Date.now(),
    conversationCount: 0,
    kbDocumentCount: 0,
  };
  mockUsers = [newUser, ...mockUsers];
  return newUser;
}

export async function updateUser(id: string, patch: Partial<Pick<AdminUser, 'name' | 'email' | 'role' | 'status'>>): Promise<void> {
  await delay();
  mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, ...patch } : u));
}

export async function deleteUser(id: string): Promise<void> {
  await delay();
  mockUsers = mockUsers.filter((u) => u.id !== id);
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  await delay();
  // mock: 不实际存密码
  void id;
  void newPassword;
}

// ---------- 模型目录 ----------

export async function getVendorCatalog(): Promise<AdminVendor[]> {
  await delay();
  return mockVendors.map((v) => ({ ...v, models: v.models.map((m) => ({ ...m })) }));
}

export async function updateVendorVisibility(vendor: string, visible: boolean): Promise<void> {
  await delay();
  mockVendors = mockVendors.map((v) => (v.vendor === vendor ? { ...v, visible } : v));
}

export async function updateModelVisibility(vendor: string, modelCode: string, visible: boolean): Promise<void> {
  await delay();
  mockVendors = mockVendors.map((v) =>
    v.vendor === vendor
      ? { ...v, models: v.models.map((m) => (m.modelCode === modelCode ? { ...m, visible } : m)) }
      : v,
  );
}

export async function setDefaultModel(vendor: string, modelCode: string): Promise<void> {
  await delay();
  mockVendors = mockVendors.map((v) => ({
    ...v,
    models: v.models.map((m) => ({ ...m, isDefault: m.modelCode === modelCode && v.vendor === vendor })),
  }));
}

// ---------- 监控 ----------

export async function getCallStats(): Promise<CallStatDay[]> {
  await delay(200);
  return [...mockCallStats];
}

export async function getOnlineSessions(): Promise<OnlineSession[]> {
  await delay(200);
  return [...mockOnlineSessions];
}

export async function kickSession(sessionId: string): Promise<void> {
  await delay();
  mockOnlineSessions = mockOnlineSessions.filter((s) => s.sessionId !== sessionId);
}

export async function getErrorLogs(): Promise<ErrorLog[]> {
  await delay(200);
  return [...mockErrorLogs];
}

// ---------- 审计日志 ----------

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  await delay(200);
  return [...mockAuditLogs];
}

// ---------- 系统配置 ----------

export async function getSystemConfig(): Promise<SystemConfig> {
  await delay(200);
  return { ...mockSystemConfig };
}

export async function saveSystemConfig(patch: Partial<SystemConfig>): Promise<void> {
  await delay();
  mockSystemConfig = { ...mockSystemConfig, ...patch };
}

// ---------- 定时任务 ----------

export async function getTasks(): Promise<ScheduledTask[]> {
  await delay(200);
  return [...mockTasks];
}

export async function toggleTask(id: string, enabled: boolean): Promise<void> {
  await delay();
  mockTasks = mockTasks.map((t) => (t.id === id ? { ...t, enabled } : t));
}

export async function runTaskNow(id: string): Promise<void> {
  await delay(500);
  mockTasks = mockTasks.map((t) =>
    t.id === id ? { ...t, lastRunAt: Date.now(), lastStatus: 'success' } : t,
  );
}
