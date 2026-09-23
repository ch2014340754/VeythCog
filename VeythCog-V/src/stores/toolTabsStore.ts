/**
 * 工具标签页 store
 * 把 ToolsLayout 里的 openTabs 提到全局，刷新不丢
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ToolTab } from '@/types';

interface ToolTabsState {
  tabs: ToolTab[];
  activeId: string | null;

  openTab: (tab: ToolTab) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  closeAll: () => void;
}

export const useToolTabsStore = create<ToolTabsState>()(
  persist(
    (set) => ({
      tabs: [],
      activeId: null,

      openTab: (tab) =>
        set((s) => ({
          tabs: s.tabs.some((t) => t.id === tab.id) ? s.tabs : [...s.tabs, tab],
          activeId: tab.id,
        })),
      closeTab: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id);
          const newTabs = s.tabs.filter((t) => t.id !== id);
          return {
            tabs: newTabs,
            activeId: s.activeId === id ? newTabs[idx]?.id ?? newTabs[idx - 1]?.id ?? null : s.activeId,
          };
        }),
      setActive: (id) => set({ activeId: id }),
      closeAll: () => set({ tabs: [], activeId: null }),
    }),
    { name: 'mywork:tool-tabs' }
  )
);
