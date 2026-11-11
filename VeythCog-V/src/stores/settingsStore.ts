/**
 * 全局设置 store
 * 主题在 ThemeContext，这里放：
 *   - 我的绑定模型列表（后端 GET /llm/models）
 *   - 当前选中的模型 id（vendor:modelCode）
 *   - 流式开关、侧栏折叠等其他偏好
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LlmModelItem } from '@/types';
import { getModels } from '@/api/llm';
import type { BackgroundValue } from '@/styles/backgrounds';

/** 模型唯一 id = vendor:modelCode */
export function modelId(vendor: string, modelCode: string): string {
  return `${vendor}:${modelCode}`;
}

interface SettingsState {
  /** 我的绑定模型 */
  models: LlmModelItem[];
  /** 当前选中的模型 id（vendor:modelCode） */
  currentModelId: string | null;
  /** 是否开启流式输出 */
  streamEnabled: boolean;
  /** 侧栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 全局毛玻璃开关 */
  glassEnabled: boolean;
  /** 毛玻璃朦胧感（玻璃面板不透明度 10-90，默认 60） */
  glassOpacity: number;
  /** 纯色/渐变兜底背景：'none' | 'preset:<id>'（壁纸由 wallpaperStore 管理） */
  background: BackgroundValue;
  /** 壁纸遮罩强度（0-100，0 = 不加遮罩） */
  overlayOpacity: number;
  /** 加载中 */
  loadingModels: boolean;

  /** 从后端拉取我的绑定模型；当前模型无效时自动选默认模型 */
  loadModels: () => Promise<void>;
  setModels: (list: LlmModelItem[]) => void;
  setCurrentModel: (id: string) => void;
  setStreamEnabled: (v: boolean) => void;
  toggleSidebar: () => void;
  setGlassEnabled: (v: boolean) => void;
  setGlassOpacity: (v: number) => void;
  setBackground: (v: BackgroundValue) => void;
  setOverlayOpacity: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      models: [],
      currentModelId: null,
      streamEnabled: true,
      sidebarCollapsed: false,
      glassEnabled: false,
      glassOpacity: 60,
      background: 'none',
      overlayOpacity: 58,
      loadingModels: false,

      loadModels: async () => {
        set({ loadingModels: true });
        try {
          const list = await getModels();
          // 防御：后端未部署时调用方可能返回非数组（历史问题：HTML fallback 被当数据）
          if (!Array.isArray(list)) return;
          set({ models: list });
          // 当前模型无效时自动选默认模型
          const cur = get().currentModelId;
          const valid = list.some((m) => modelId(m.vendor, m.modelCode) === cur);
          if (!valid) {
            const def = list.find((m) => m.isDefault) ?? list[0];
            set({ currentModelId: def ? modelId(def.vendor, def.modelCode) : null });
          }
        } catch {
          // 后端未部署 / 网络不可达：静默保持空 models，页面会显示"去配置模型"提示
        } finally {
          set({ loadingModels: false });
        }
      },

      setModels: (list) => set({ models: list }),
      setCurrentModel: (id) => set({ currentModelId: id }),
      setStreamEnabled: (v) => set({ streamEnabled: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setGlassEnabled: (v) => set({ glassEnabled: v }),
      setGlassOpacity: (v) => set({ glassOpacity: v }),
      setBackground: (v) => set({ background: v }),
      setOverlayOpacity: (v) => set({ overlayOpacity: v }),
    }),
    {
      name: 'mywork:settings',
      version: 7,
      migrate: (persisted: any, version) => {
        const state: any = persisted ? { ...persisted } : {};

        // v1（旧扁平 providers）→ 全新结构：丢弃旧 providers/models，回到空绑定列表
        if (version < 2 && !Array.isArray(state.models)) {
          state.models = [];
          state.currentModelId = null;
        }
        // v2 → v3：补默认背景字段
        if (version < 3) {
          state.background = state.background ?? 'none';
        }
        // v3 → v4：补毛玻璃朦胧感默认值
        if (version < 4) {
          state.glassOpacity = typeof state.glassOpacity === 'number' ? state.glassOpacity : 60;
        }
        // v5 → v6：壁纸改为全局唯一（存后端 nav_setting），清理自定义 URL 背景
        if (version < 6 && typeof state.background === 'string' && state.background.startsWith('url:')) {
          state.background = 'none';
        }
        // v6 → v7：遮罩强度由三档改为 0-100 连续值
        if (version < 7) {
          const legacy = state.overlayStrength as string | undefined;
          const map: Record<string, number> = { soft: 42, medium: 58, deep: 72 };
          if (typeof state.overlayOpacity !== 'number') {
            state.overlayOpacity = map[legacy ?? 'medium'] ?? 58;
          }
          delete state.overlayStrength;
        }
        // 兜底：任何缺失都回到可用默认值
        if (typeof state.overlayOpacity !== 'number') state.overlayOpacity = 58;
        if (state.background == null) state.background = 'none';
        return state;
      },
    },
  ),
);
