/**
 * 导航首页 store（iTab 风格新标签页）
 * persist 字段：activeCategoryId（上次选中分类）、searchEngine（搜索引擎）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getCategories,
  getBookmarks,
  getNavSetting,
  updateNavSetting,
  type NavCategory,
  type NavBookmark,
} from '@/api/nav';

interface NavState {
  /** 分类列表 */
  categories: NavCategory[];
  /** 当前选中分类 id */
  activeCategoryId: number | null;
  /** 当前分类下的书签列表 */
  bookmarks: NavBookmark[];
  /** 当前搜索引擎 */
  searchEngine: 'baidu' | 'google' | 'bing';
  /** 是否正在加载书签（细进度条用） */
  loadingBookmarks: boolean;

  /** 加载分类列表 */
  loadCategories: () => Promise<void>;
  /** 加载某分类下的书签 */
  loadBookmarks: (categoryId: number) => Promise<void>;
  /** 切换当前分类 */
  setActiveCategory: (id: number) => Promise<void>;
  /** 设置搜索引擎 */
  setSearchEngine: (engine: 'baidu' | 'google' | 'bing') => void;
  /** 从后端拉取用户配置（搜索引擎 / 上次分类） */
  loadSetting: () => Promise<void>;
}

export const useNavStore = create<NavState>()(
  persist(
    (set, get) => ({
      categories: [],
      activeCategoryId: null,
      bookmarks: [],
      searchEngine: 'baidu',
      loadingBookmarks: false,

      loadCategories: async () => {
        try {
          const list = await getCategories();
          set({ categories: list });
          if (list.length === 0) return;
          // 无论是否已有持久化的 activeCategoryId，都要拉一次书签，
          // 否则刷新后分类高亮着但图标区是空的
          const current = get().activeCategoryId;
          const exists = current != null && list.some((c) => c.id === current);
          const targetId = exists
            ? (current as number)
            : (list.find((c) => c.isDefault) ?? list[0]).id;
          if (!exists) set({ activeCategoryId: targetId });
          await get().loadBookmarks(targetId);
        } catch (e) {
          console.error('[navStore] loadCategories failed', e);
        }
      },

      loadBookmarks: async (categoryId: number) => {
        set({ loadingBookmarks: true });
        try {
          const list = await getBookmarks(categoryId);
          set({ bookmarks: list });
        } catch (e) {
          console.error('[navStore] loadBookmarks failed', e);
        } finally {
          set({ loadingBookmarks: false });
        }
      },

      setActiveCategory: async (id: number) => {
        if (id === get().activeCategoryId) return;
        set({ activeCategoryId: id });
        // 无感刷新：保留旧书签显示，只在细进度条上体现
        await get().loadBookmarks(id);
        // fire-and-forget 持久化 activeCategoryId
        updateNavSetting({ activeCategoryId: id }).catch(() => {});
      },

      setSearchEngine: (engine) => {
        set({ searchEngine: engine });
        updateNavSetting({ searchEngine: engine }).catch(() => {});
      },

      loadSetting: async () => {
        try {
          const s = await getNavSetting();
          if (s.searchEngine) set({ searchEngine: s.searchEngine });
          if (s.activeCategoryId != null) set({ activeCategoryId: s.activeCategoryId });
        } catch (e) {
          console.error('[navStore] loadSetting failed', e);
        }
      },
    }),
    {
      name: 'veythcog:nav:v1',
      // 只持久化用户偏好，不持久化运行时数据
      partialize: (state) => ({
        activeCategoryId: state.activeCategoryId,
        searchEngine: state.searchEngine,
      }),
    },
  ),
);
