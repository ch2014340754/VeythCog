/**
 * 认证 API（对接后端 vc-chat）
 *   login  → POST /auth/login  { username, password } → { token, username, nickname }
 */
import { http, uploadFile } from '@/api/client';
import { MOCK_TOKEN } from '@/config';
import { useModeStore } from '@/stores/modeStore';
import { mockUsers, addMockUser } from '@/mock/users';
import type { User } from '@/types';

export interface LoginResult {
  token: string;
  user: User;
}

/** 后端登录返回体（data 部分） */
interface LoginData {
  token: string;
  username: string;
  nickname?: string;
  /** 角色：admin / user（后端下发） */
  role?: string;
  /** 头像 S3 公开直链（可选） */
  avatarUrl?: string;
}

/** 登录 */
export async function login(username: string, password: string): Promise<LoginResult> {
  if (!username.trim()) throw new Error('请输入用户名');

  // ===== 本地绕过模式（后端未部署，登录页默认）=====
  // 本地伪造登录态：admin/admin123 为管理员；其余账号需先在 mock 用户存储中存在。
  if (useModeStore.getState().bypassMode) {
    const u = username.trim();
    if (u === 'admin' && password === 'admin123') {
      return {
        token: MOCK_TOKEN,
        user: { id: 'admin', name: 'admin', role: 'admin' },
      };
    }
    const m = mockUsers.find((x) => x.username === u);
    if (!m || !password || password.length < 6) {
      throw new Error('用户名或密码错误');
    }
    if (m.status === 'disabled') {
      throw new Error('该账号已被禁用，请联系管理员');
    }
    return {
      token: MOCK_TOKEN,
      user: {
        id: m.id,
        name: m.nickname || m.username,
        role: m.role,
      },
    };
  }
  // =================================================

  const data = await http.post<LoginData>('/auth/login', { username, password });
  const role: 'admin' | 'user' = data.role === 'admin' ? 'admin' : 'user';
  return {
    token: data.token,
    user: {
      id: data.username,
      name: data.nickname || data.username,
      avatar: data.avatarUrl || undefined,
      role,
    },
  };
}

/** 注册：调 POST /auth/register，成功返回（后端返回用户 id，前端不取用） */
export interface RegisterParams {
  username: string;
  password: string;
  nickname?: string;
}

export async function register(params: RegisterParams): Promise<void> {
  // ===== 本地绕过模式（后端未部署）：写入本地 mock 用户存储，供 Admin 可见 =====
  if (useModeStore.getState().bypassMode) {
    const u = params.username.trim();
    if (!u) throw new Error('请输入用户名');
    if (!params.password || params.password.length < 6) throw new Error('密码至少 6 位');
    if (u === 'admin' || mockUsers.some((x) => x.username === u)) {
      throw new Error('用户名已存在');
    }
    addMockUser({ username: u, nickname: params.nickname?.trim() || u, role: 'user' });
    return;
  }
  // =================================================

  await http.post<number>('/auth/register', {
    username: params.username.trim(),
    password: params.password,
    nickname: params.nickname?.trim() || undefined,
  });
}

/** 后端 GET /auth/me 返回体 */
interface UserProfileData {
  id: number;
  username: string;
  nickname?: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
}

/** 获取当前用户资料（含头像直链） */
export async function fetchMe(): Promise<User | null> {
  if (useModeStore.getState().bypassMode) return null;
  const data = await http.get<UserProfileData>('/auth/me');
  const role: 'admin' | 'user' = data.role === 'admin' ? 'admin' : 'user';
  return {
    id: String(data.id),
    name: data.nickname || data.username,
    email: data.email || undefined,
    avatar: data.avatarUrl || undefined,
    role,
  };
}

/** 头像上传结果 */
export interface AvatarUploadResult {
  avatarKey: string;
  avatarUrl: string;
}

/** 上传头像到 S3 并绑定当前用户 */
export async function uploadAvatar(file: File): Promise<AvatarUploadResult> {
  if (useModeStore.getState().bypassMode) {
    throw new Error('本地绕过模式未接后端，无法上传头像');
  }
  return uploadFile<AvatarUploadResult>('/auth/avatar', file);
}

/** 恢复默认头像：清除后端绑定并删除 S3 对象 */
export async function removeAvatar(): Promise<void> {
  if (useModeStore.getState().bypassMode) {
    throw new Error('本地绕过模式未接后端，无法修改头像');
  }
  await http.del('/auth/avatar');
}

/** 退出登录（后端无服务端会话，仅前端清 token） */
export async function logout(): Promise<void> {
  // 无操作，token 由前端清理
}
