/**
 * mock 用户存储（后端未部署时使用）
 * 与 api/auth.ts / api/admin.ts 共享：注册新增的用户会进入此列表，
 * 从而在 Admin 用户管理页可见（仅 mock 模式下生效）。
 */
export interface MockUser {
  id: string;
  username: string;
  nickname: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  /** epoch 毫秒 */
  createTime: number;
}

export const mockUsers: MockUser[] = [
  {
    id: '1',
    username: 'admin',
    nickname: '管理员',
    email: 'admin@veythcog.dev',
    role: 'admin',
    status: 'active',
    createTime: Date.now() - 90 * 86400_000,
  },
  {
    id: '2',
    username: 'chenjie',
    nickname: '陈杰',
    email: 'chenjie@veythcog.dev',
    role: 'user',
    status: 'active',
    createTime: Date.now() - 45 * 86400_000,
  },
  {
    id: '3',
    username: 'zhangwei',
    nickname: '张伟',
    email: 'zhangwei@example.com',
    role: 'user',
    status: 'active',
    createTime: Date.now() - 20 * 86400_000,
  },
];

/** 新增 mock 用户（注册/后台创建共用），返回新用户 */
export function addMockUser(input: {
  username: string;
  nickname?: string;
  email?: string;
  role?: 'admin' | 'user';
}): MockUser {
  const user: MockUser = {
    id: String(mockUsers.length + 1),
    username: input.username,
    nickname: input.nickname || input.username,
    email: input.email || '',
    role: input.role || 'user',
    status: 'active',
    createTime: Date.now(),
  };
  mockUsers.push(user);
  return user;
}
