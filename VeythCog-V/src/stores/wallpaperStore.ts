/* ========================================
   全局壁纸：全站唯一一张，与用户绑定（后端 nav_setting.current_wallpaper_key）
   来源为 S3 壁纸桶，按文件后缀区分静态图 / 动态视频
   ======================================== */
import { create } from 'zustand';
import {
  getCurrentWallpaper,
  getRandomWallpaper,
  listWallpapers,
  lockWallpaper,
  type WallpaperItem,
} from '@/api/nav';

export type WallpaperKind = 'image' | 'video';

export interface ActiveWallpaper extends WallpaperItem {
  kind: WallpaperKind;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;

/** 清单缓存：预签名 URL 7 天有效，这里按 6 天缓存，避免每次开弹窗都重新签名、重新下载 */
const LIST_CACHE_KEY = 'veythcog:nav:wallpaper-list';
const LIST_TTL = 6 * 24 * 60 * 60 * 1000;

function readCachedList(): WallpaperItem[] | null {
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed.items)) return null;
    if (Date.now() - parsed.ts > LIST_TTL) return null;
    return parsed.items as WallpaperItem[];
  } catch {
    return null;
  }
}

function writeCachedList(items: WallpaperItem[]) {
  try {
    sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {
    /* 缓存写失败不影响功能 */
  }
}

/** 按对象 key 后缀判断壁纸类型（gif 仍按静态图渲染，浏览器可直接播放） */
export function wallpaperKind(key: string): WallpaperKind {
  return VIDEO_EXT.test(key) ? 'video' : 'image';
}

interface WallpaperState {
  /** 当前生效壁纸（全局唯一） */
  active: ActiveWallpaper | null;
  /** 壁纸库清单（壁纸管理弹窗用） */
  list: WallpaperItem[];
  loadingList: boolean;

  /** 登录后读取用户预设壁纸 */
  loadActive: () => Promise<void>;
  /** 拉取壁纸库清单（默认命中缓存，force=true 时强制重新签名） */
  loadList: (force?: boolean) => Promise<void>;
  /** 选用某张壁纸（立即全局生效并写入用户配置） */
  select: (item: WallpaperItem) => Promise<void>;
  /** 随机切换一张（仅右键「切换壁纸」触发） */
  switchRandom: () => Promise<void>;
  /** 清除壁纸，回到纯色/渐变兜底 */
  clear: () => Promise<void>;
  /** 登出时清空 */
  reset: () => void;
}

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  active: null,
  list: [],
  loadingList: false,

  loadActive: async () => {
    try {
      const item = await getCurrentWallpaper();
      set({ active: item ? { ...item, kind: wallpaperKind(item.key) } : null });
    } catch (e) {
      console.error('[wallpaperStore] loadActive failed', e);
    }
  },

  loadList: async (force = false) => {
    if (get().loadingList) return;
    // 本会话已有清单，或命中上次会话的缓存 → 直接用，不再请求（URL 不变，浏览器可复用图片缓存）
    if (!force) {
      if (get().list.length > 0) return;
      const cached = readCachedList();
      if (cached && cached.length > 0) {
        set({ list: cached });
        return;
      }
    }
    set({ loadingList: true });
    try {
      const list = await listWallpapers();
      set({ list });
      writeCachedList(list);
    } catch (e) {
      console.error('[wallpaperStore] loadList failed', e);
    } finally {
      set({ loadingList: false });
    }
  },

  select: async (item) => {
    // 先本地生效（无感切换），再落库到用户配置
    set({ active: { ...item, kind: wallpaperKind(item.key) } });
    try {
      await lockWallpaper(item.key);
    } catch (e) {
      console.error('[wallpaperStore] lock failed', e);
    }
  },

  switchRandom: async () => {
    try {
      const item = await getRandomWallpaper();
      if (!item) return;
      set({ active: { ...item, kind: wallpaperKind(item.key) } });
      await lockWallpaper(item.key);
    } catch (e) {
      console.error('[wallpaperStore] switchRandom failed', e);
    }
  },

  clear: async () => {
    set({ active: null });
    try {
      await lockWallpaper(null);
    } catch (e) {
      console.error('[wallpaperStore] clear failed', e);
    }
  },

  reset: () => set({ active: null, list: [] }),
}));
