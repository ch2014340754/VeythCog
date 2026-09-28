/**
 * 认证 API（对接后端 vc-chat）
 *   login  → POST /auth/login  { username, password } → { token, username, nickname }
 */
import { http } from '@/api/client';
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
}

/** 登录：调后端，真 JWT */
export async function login(username: string, password: string): Promise<LoginResult> {
  if (!username.trim()) throw new Error('请输入用户名');
  const data = await http.post<LoginData>('/auth/login', { username, password });
  // TODO: 后端应在登录返回体里带 role，前端先按 username 推断，对接后改
  const role: 'admin' | 'user' = data.username === 'admin' ? 'admin' : 'user';
  return {
    token: data.token,
    user: {
      id: data.username,
      name: data.nickname || data.username,
      role,
    },
  };
}

/** 获取当前用户（后端暂未提供 /auth/me，返回 null） */
export async function fetchMe(): Promise<User | null> {
  return null;
}

/** 退出登录（后端无服务端会话，仅前端清 token） */
export async function logout(): Promise<void> {
  // 无操作，token 由前端清理
}
