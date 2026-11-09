/**
 * 运行时模式开关（登录页可切换，localStorage 持久化）
 * - bypassMode=false（默认）：正常登录，走真实后端
 * - bypassMode=true：本地绕过/mock，不打后端（仅联调/演示用）
 *
 * 登录页默认收起「运行模式」，需要时再展开切换。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '@/config';

interface ModeState {
  /** true = 本地绕过(mock)，false = 真实后端（默认） */
  bypassMode: boolean;
  /** 联调模式下的后端 API 地址（默认读 env，可在登录页覆盖） */
  apiBase: string;
  setBypassMode: (v: boolean) => void;
  setApiBase: (v: string) => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      bypassMode: false,
      apiBase: config.apiBase,
      setBypassMode: (v) => set({ bypassMode: v }),
      setApiBase: (v) => set({ apiBase: v.replace(/\/+$/, '') }),
    }),
    // 变更默认值（正常登录 / 后端地址修正为 8123）后升 key，
    // 避免旧 localStorage 里的 bypass=true 或 apiBase=8080 覆盖新默认
    { name: 'veythcog:mode:v3' },
  ),
);
