/**
 * 系统管理 API
 * - 用户管理 / 模型目录 / 系统监控：已对接真实后端
 * - 审计 / 系统配置 / 定时任务：仍为 mock（后端未实现）
 */
import type {
  AdminUser,
  AdminVendor,
  AuditLogEntry,
  SystemConfig,
  ScheduledTask,
  MonitorOverview,
  MonitorPoint,
  MonitorEndpoint,
  MonitorError,
  MonitorLlmSummary,
  MonitorSession,
  MonitorResource,
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

// ---------- 本地绕过模式的监控假数据（后端联调时走真实接口） ----------

function mockOverview(): MonitorOverview {
  return {
    calls: 186, errors: 7, errorRate: 0.0376, p95Ms: 412, avgCostMs: 137,
    llmCalls: 42, promptTokens: 58200, completionTokens: 41200, totalTokens: 99400,
    estimatedCalls: 0, activeUsers: 3, onlineSessions: 2, callsLastMinute: 4,
  };
}

function mockPoints(hours: number): MonitorPoint[] {
  const count = hours <= 24 ? 24 : Math.min(7, hours);
  return Array.from({ length: count }, (_, i) => ({
    time: hours <= 24
      ? `${String(i).padStart(2, '0')}:00`
      : `第 ${i + 1} 天`,
    calls: 40 + ((i * 37) % 90),
    errors: (i % 6) + 1,
    avgCostMs: 90 + ((i * 13) % 60),
    p95Ms: 300 + ((i * 29) % 260),
    tokens: 8000 + ((i * 1700) % 20000),
  }));
}

function mockEndpoints(): MonitorEndpoint[] {
  return [
    { route: '/chat/message', method: 'POST', calls: 68, errors: 3, errorRate: 0.044, avgCostMs: 620, p95Ms: 1320, maxCostMs: 2210 },
    { route: '/chat/conversations', method: 'GET', calls: 45, errors: 0, errorRate: 0, avgCostMs: 42, p95Ms: 88, maxCostMs: 140 },
    { route: '/knowledge/doc', method: 'GET', calls: 32, errors: 1, errorRate: 0.031, avgCostMs: 61, p95Ms: 120, maxCostMs: 210 },
    { route: '/nav/bookmark', method: 'GET', calls: 21, errors: 0, errorRate: 0, avgCostMs: 18, p95Ms: 36, maxCostMs: 70 },
  ];
}

function mockErrors(): MonitorError[] {
  const now = Date.now();
  return [
    { id: 1, time: new Date(now - 600_000).toLocaleString('zh-CN'), route: '/chat/message', method: 'POST', bizCode: 50000, status: 200, userId: 1, rid: 'a1b2c3', message: '模型调用失败：403 Free quota exhausted' },
    { id: 2, time: new Date(now - 5_400_000).toLocaleString('zh-CN'), route: '/knowledge/doc', method: 'GET', bizCode: 40400, status: 200, userId: 2, rid: 'd4e5f6', message: '文档不存在' },
  ];
}

function mockLlm(): MonitorLlmSummary {
  return {
    rows: [
      { vendor: 'dashscope', modelCode: 'qwen-plus', calls: 30, errors: 4, promptTokens: 41000, completionTokens: 30000, totalTokens: 71000, avgLatencyMs: 980, maxLatencyMs: 2400 },
      { vendor: 'deepseek', modelCode: 'deepseek-chat', calls: 12, errors: 1, promptTokens: 17200, completionTokens: 11200, totalTokens: 28400, avgLatencyMs: 640, maxLatencyMs: 1500 },
    ],
    calls: 42,
    totalTokens: 99400,
    errors: 5,
  };
}

let mockSessions: MonitorSession[] = [
  {
    sid: 'sess-001', userId: 1, username: 'admin', nickname: '管理员', ip: '192.168.1.10',
    userAgent: 'Chrome / Windows', loginAt: '2026-11-13 09:12:00', lastActiveAt: '2026-11-13 10:01:00',
    online: true, status: 'active',
  },
  {
    sid: 'sess-002', userId: 2, username: 'chenjie', nickname: '陈杰', ip: '192.168.1.25',
    userAgent: 'Edge / Windows', loginAt: '2026-11-13 08:40:00', lastActiveAt: '2026-11-13 09:55:00',
    online: true, status: 'active',
  },
];

function mockResource(): MonitorResource {
  return {
    osName: 'Windows 11', osVersion: '10.0', cpuCores: 16,
    systemCpuLoad: 0.32, processCpuLoad: 0.06, systemLoadAverage: -1,
    memoryTotal: 16 * 1024 ** 3, memoryUsed: 9 * 1024 ** 3,
    swapTotal: 0, swapUsed: 0,
    heapUsed: 512 * 1024 ** 2, heapMax: 4 * 1024 ** 3, heapCommitted: 700 * 1024 ** 2,
    nonHeapUsed: 180 * 1024 ** 2, liveThreads: 46, jvmUptimeMs: 3 * 3600_000,
    jvmStartTime: '2026-11-13 07:00:00',
    diskPath: 'D:\\veyth-cog', diskTotal: 500 * 1024 ** 3,
    diskUsable: 420 * 1024 ** 3, diskUsed: 80 * 1024 ** 3,
    sampledAt: '2026-11-13 10:02:00',
  };
}

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

// ---------- 系统监控（真实数据） ----------

export async function getMonitorOverview(hours = 24): Promise<MonitorOverview> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockOverview();
  }
  return http.get<MonitorOverview>('/admin/monitor/overview', { hours });
}

export async function getMonitorTimeseries(hours = 24): Promise<MonitorPoint[]> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockPoints(hours);
  }
  return http.get<MonitorPoint[]>('/admin/monitor/timeseries', { hours });
}

export async function getMonitorEndpoints(
  hours = 24,
  sort: 'calls' | 'errors' | 'p95' = 'calls',
  limit = 20,
): Promise<MonitorEndpoint[]> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockEndpoints();
  }
  return http.get<MonitorEndpoint[]>('/admin/monitor/endpoints', { hours, sort, limit });
}

export async function getMonitorErrors(hours = 24, limit = 50): Promise<MonitorError[]> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockErrors();
  }
  return http.get<MonitorError[]>('/admin/monitor/errors', { hours, limit });
}

export async function getMonitorLlm(hours = 24): Promise<MonitorLlmSummary> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockLlm();
  }
  return http.get<MonitorLlmSummary>('/admin/monitor/llm', { hours });
}

export async function getMonitorSessions(): Promise<MonitorSession[]> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return [...mockSessions];
  }
  return http.get<MonitorSession[]>('/admin/monitor/sessions');
}

/** 强制下线：后端把会话置 kicked，该 token 下一次请求即 401 */
export async function kickSession(sid: string): Promise<void> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    mockSessions = mockSessions.filter((s) => s.sid !== sid);
    return;
  }
  await http.post<boolean>(`/admin/monitor/sessions/${encodeURIComponent(sid)}/kick`);
}

export async function getMonitorResources(): Promise<MonitorResource> {
  if (useModeStore.getState().bypassMode) {
    await delay();
    return mockResource();
  }
  return http.get<MonitorResource>('/admin/monitor/resources');
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
