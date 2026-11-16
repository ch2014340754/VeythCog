/**
 * 划词 AI 的设备级开关。
 * 放 localStorage 而不是 user_setting：这个开关和"这台设备怎么用"有关
 * （移动端 / 触屏根本不启用），跟账号画像无关。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectionAskState {
  /** 是否启用划词悬浮条（默认开；移动端即使开也不挂载） */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useSelectionAskStore = create<SelectionAskState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
    }),
    { name: 'vc:selection-ask' },
  ),
);
