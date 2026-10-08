/**
 * 认证 API（对接后端 vc-chat）
 *   login  → POST /auth/login  { username, password } → { token, username, nickname }
 */
import { http } from '@/api/client';
import type { User } from '@/types';

/** 本地绕过登录的伪 token（后端未部署时使用）。后端部署好后删除 auth.ts 里的绕过分支即可。 */
export const DEV_BYPASS_TOKEN = 'dev-bypass-token';

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

  // ===== 本地绕过登录（后端未部署时使用）=====
  // 账密为 admin / admin123 时，直接在前端伪造登录态，不请求后端。
  // 后端部署完成后，删除此 if 块及 DEV_BYPASS_TOKEN 即可恢复真 JWT 登录。
  if (username.trim() === 'admin' && password === 'admin123') {
    return {
      token: DEV_BYPASS_TOKEN,
      user: {
        id: 'admin',
        name: 'admin',
        role: 'admin',
      },
    };
  }
  // ==========================================

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
