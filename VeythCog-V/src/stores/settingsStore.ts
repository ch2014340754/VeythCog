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
import type { BackgroundValue, OverlayStrength } from '@/styles/backgrounds';

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
  /** 背景（内置渐变 / 自定义 URL）：'none' | 'preset:<id>' | 'url:<地址>' */
  background: BackgroundValue;
  /** 自定义图片遮罩强度 */
  overlayStrength: OverlayStrength;
  /** 加载中 */
  loadingModels: boolean;

  /** 从后端拉取我的绑定模型；当前模型无效时自动选默认模型 */
  loadModels: () => Promise<void>;
  setModels: (list: LlmModelItem[]) => void;
  setCurrentModel: (id: string) => void;
  setStreamEnabled: (v: boolean) => void;
  toggleSidebar: () => void;
  setGlassEnabled: (v: boolean) => void;
  setBackground: (v: BackgroundValue) => void;
  setOverlayStrength: (v: OverlayStrength) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      models: [],
      currentModelId: null,
      streamEnabled: true,
      sidebarCollapsed: false,
      glassEnabled: false,
      background: 'none',
      overlayStrength: 'medium',
      loadingModels: false,

      loadModels: async () => {
        set({ loadingModels: true });
        try {
          const list = await getModels();
          set({ models: list });
          // 当前模型无效时自动选默认模型
          const cur = get().currentModelId;
          const valid = list.some((m) => modelId(m.vendor, m.modelCode) === cur);
          if (!valid) {
            const def = list.find((m) => m.isDefault) ?? list[0];
            set({ currentModelId: def ? modelId(def.vendor, def.modelCode) : null });
          }
        } finally {
          set({ loadingModels: false });
        }
      },

      setModels: (list) => set({ models: list }),
      setCurrentModel: (id) => set({ currentModelId: id }),
      setStreamEnabled: (v) => set({ streamEnabled: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setGlassEnabled: (v) => set({ glassEnabled: v }),
      setBackground: (v) => set({ background: v }),
      setOverlayStrength: (v) => set({ overlayStrength: v }),
    }),
    {
      name: 'mywork:settings',
      version: 3,
      migrate: (persisted: any, version) => {
        // v1（旧扁平 providers）→ 全新结构：丢弃旧 providers/models，回到空绑定列表
        if (version < 2 && persisted && !Array.isArray(persisted.models)) {
          return {
            streamEnabled: true,
            sidebarCollapsed: !!persisted.sidebarCollapsed,
            glassEnabled: !!persisted.glassEnabled,
            background: persisted.background ?? 'none',
            overlayStrength: persisted.overlayStrength ?? 'medium',
            models: [],
            currentModelId: null,
          };
        }
        // v2 → v3：补默认背景字段
        if (version < 3 && persisted) {
          return {
            ...persisted,
            background: persisted.background ?? 'none',
            overlayStrength: persisted.overlayStrength ?? 'medium',
          };
        }
        return persisted;
      },
    },
  ),
);
