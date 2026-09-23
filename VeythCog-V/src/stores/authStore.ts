/**
 * 认证 store：当前用户、token、飞书绑定状态
 * persist 到 localStorage，刷新不掉登录态。
 *
 * 后端对接时：
 *   - login/loginAsGuest 改为调 api/auth.ts 的真实请求
 *   - 401 拦截在 api/client.ts 里调用 logout()
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LarkBinding } from '@/types';
import * as authApi from '@/api/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  lark: LarkBinding;
  /** 登录中（按钮 loading） */
  loading: boolean;

  isAuthenticated: () => boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;

  updateProfile: (patch: Partial<Pick<User, 'name' | 'email' | 'avatar'>>) => void;

  bindLark: (info: Pick<LarkBinding, 'openId' | 'name' | 'avatar'>) => void;
  unbindLark: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      lark: { bound: false },
      loading: false,

      isAuthenticated: () => !!get().token && !!get().user,

      login: async (username, password) => {
        set({ loading: true });
        try {
          const { token, user } = await authApi.login(username, password);
          set({ token, user, lark: { bound: false } });
        } finally {
          set({ loading: false });
        }
      },

      logout: () => {
        void authApi.logout();
        set({ token: null, user: null, lark: { bound: false } });
      },

      updateProfile: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),

      bindLark: (info) =>
        set({
          lark: {
            bound: true,
            ...info,
            boundAt: Date.now(),
          },
        }),

      unbindLark: () => set({ lark: { bound: false } }),
    }),
    {
      name: 'mywork:auth',
      partialize: (s) => ({ token: s.token, user: s.user, lark: s.lark }),
    },
  ),
);
