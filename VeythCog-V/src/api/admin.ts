/**
 * 系统管理 API
 * - 用户管理：已对接真实后端（GET/POST/PUT/DELETE /admin/users）
 * - 模型目录 / 监控 / 审计 / 系统配置 / 定时任务：仍为 mock（后端未实现）
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
import { http } from '@/api/client';
import { useModeStore } from '@/stores/modeStore';
import { mockUsers, addMockUser } from '@/mock/users';
import type { MockUser } from '@/mock/users';

// ---------- 内存数据（非用户管理的 mock 数据） ----------

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

// ---------- 用户管理（mock 模式走本地存储；真实模式对接 /admin/users） ----------

/** 后端 /admin/users 返回项 */
interface AdminUserDto {
  id: number;
  username: string;
  nickname: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  createTime: string;
}

function mapUser(d: AdminUserDto): AdminUser {
  return {
    id: String(d.id),
    username: d.username,
    name: d.nickname || d.username,
    email: d.email || undefined,
    role: d.role,
    status: d.status,
    createdAt: d.createTime ? new Date(d.createTime).getTime() : Date.now(),
    // 对话数 / 文档数 / 最后登录：后端本期不聚合，置默认
    lastLoginAt: undefined,
    conversationCount: 0,
    kbDocumentCount: 0,
  };
}

/** mock 用户 → AdminUser（mock 模式下 id=1 视为当前登录的 admin，用于自我保护） */
function mapMockUser(m: MockUser): AdminUser {
  return {
    id: m.id,
    username: m.username,
    name: m.nickname || m.username,
    email: m.email || undefined,
    role: m.role,
    status: m.status,
    createdAt: m.createTime,
    lastLoginAt: undefined,
    conversationCount: 0,
    kbDocumentCount: 0,
  };
}

export async function getUsers(): Promise<AdminUser[]> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockUsers.map(mapMockUser);
  }
  const list = await http.get<AdminUserDto[]>('/admin/users');
  return list.map(mapUser);
}

export async function createUser(input: {
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
  password: string;
}): Promise<AdminUser> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    if (mockUsers.some((m) => m.username === input.username)) {
      throw new Error('用户名已存在');
    }
    return mapMockUser(
      addMockUser({ username: input.username, nickname: input.name, email: input.email, role: input.role }),
    );
  }
  await http.post<number>('/admin/users', {
    username: input.username,
    nickname: input.name,
    email: input.email,
    role: input.role,
    password: input.password,
  });
  const list = await getUsers();
  const created = list.find((u) => u.username === input.username);
  if (created) return created;
  return {
    id: String(Date.now()),
    username: input.username,
    name: input.name,
    email: input.email,
    role: input.role,
    status: 'active',
    createdAt: Date.now(),
    conversationCount: 0,
    kbDocumentCount: 0,
  };
}

export async function updateUser(id: string, patch: Partial<Pick<AdminUser, 'name' | 'email' | 'role' | 'status'>>): Promise<void> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    const m = mockUsers.find((x) => x.id === id);
    if (!m) throw new Error('用户不存在');
    if ('status' in patch && patch.status) {
      if (id === '1' && patch.status === 'disabled') {
        throw new Error('不能禁用当前登录账号');
      }
      m.status = patch.status;
    } else {
      if (patch.name !== undefined) m.nickname = patch.name || m.username;
      if (patch.email !== undefined) m.email = patch.email ?? '';
      if (patch.role !== undefined) {
        if (id === '1' && patch.role !== 'admin') {
          throw new Error('不能撤销当前登录账号的 admin 角色');
        }
        m.role = patch.role;
      }
    }
    return;
  }
  if ('status' in patch && patch.status) {
    await http.put(`/admin/users/${id}/status`, { status: patch.status });
  } else {
    await http.put(`/admin/users/${id}`, {
      nickname: patch.name,
      email: patch.email,
      role: patch.role,
    });
  }
}

export async function deleteUser(id: string): Promise<void> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    const i = mockUsers.findIndex((m) => m.id === id);
    if (i < 0) throw new Error('用户不存在');
    if (id === '1') throw new Error('不能删除当前登录账号');
    mockUsers.splice(i, 1);
    return;
  }
  await http.del(`/admin/users/${id}`);
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    if (!mockUsers.some((m) => m.id === id)) throw new Error('用户不存在');
    return; // mock 不存密码
  }
  await http.put(`/admin/users/${id}/password`, { password: newPassword });
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

// ---------- 角色管理 ----------

export interface RoleItem {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export async function getRoles(): Promise<RoleItem[]> {
  if (useModeStore.getState().bypassMode) {
    await delay(200);
    return [
      { id: 1, code: 'admin', name: '管理员', description: '系统管理员，拥有全部权限' },
      { id: 2, code: 'user', name: '普通用户', description: '基础用户，可使用对话/知识库功能' },
    ];
  }
  return http.get<RoleItem[]>('/admin/roles');
}
