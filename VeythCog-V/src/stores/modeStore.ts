/**
 * 运行时模式开关（登录页可切换，localStorage 持久化）
 * - bypassMode=true （默认）：本地绕过/mock，不打后端，开箱即用
 * - bypassMode=false：联调真实后端，apiBase 指向已部署的服务器
 *
 * 后端正式上线后，登录页切到「真实后端联调」并填入服务器地址即可，
 * 无需重新打包。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { config } from '@/config';

interface ModeState {
  /** true = 本地绕过(mock)，false = 真实后端联调 */
  bypassMode: boolean;
  /** 联调模式下的后端 API 地址（默认读 env，可在登录页覆盖） */
  apiBase: string;
  setBypassMode: (v: boolean) => void;
  setApiBase: (v: string) => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      bypassMode: true,
      apiBase: config.apiBase,
      setBypassMode: (v) => set({ bypassMode: v }),
      setApiBase: (v) => set({ apiBase: v.replace(/\/+$/, '') }),
    }),
    { name: 'veythcog:mode' },
  ),
);
