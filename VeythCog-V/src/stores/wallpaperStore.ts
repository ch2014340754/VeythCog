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
/** 缓存命中后仍超过这个时长，就在后台静默刷新一次（新上传的壁纸能及时出现在壁纸库） */
const LIST_SILENT_REFRESH_AFTER = 10 * 60 * 1000;

function readCachedList(): { items: WallpaperItem[]; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed.items)) return null;
    if (Date.now() - parsed.ts > LIST_TTL) return null;
    return { items: parsed.items as WallpaperItem[], ts: parsed.ts as number };
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

/**
 * 解析某张壁纸的类型：**以服务端下发的 kind 为准**，缺失时（旧缓存 / 旧接口）才回退后缀判断。
 * 前端所有渲染点都必须走这里，避免出现把 mp4 塞进 <img> 的裂图。
 */
export function resolveWallpaperKind(item: { key: string; kind?: WallpaperKind }): WallpaperKind {
  if (item.kind === 'video' || item.kind === 'image') return item.kind;
  return wallpaperKind(item.key);
}

interface WallpaperState {
  /** 当前生效壁纸（全局唯一） */
  active: ActiveWallpaper | null;
  /** 壁纸库清单（壁纸管理弹窗用） */
  list: WallpaperItem[];
  loadingList: boolean;

  /** 登录后读取用户预设壁纸 */
  loadActive: () => Promise<void>;
  /** 直接应用服务端下发的壁纸（首页 bootstrap 已带回，避免重复请求） */
  applyActive: (item: WallpaperItem | null) => void;
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
      set({ active: item ? { ...item, kind: resolveWallpaperKind(item) } : null });
    } catch (e) {
      console.error('[wallpaperStore] loadActive failed', e);
    }
  },

  applyActive: (item) => {
    set({ active: item ? { ...item, kind: resolveWallpaperKind(item) } : null });
  },

  loadList: async (force = false) => {
    if (get().loadingList) return;
    // 本会话已有清单，或命中上次会话的缓存 → 先用它渲染（无感），必要时再静默刷新
    if (!force) {
      if (get().list.length > 0) return;
      const cached = readCachedList();
      if (cached && cached.items.length > 0) {
        set({ list: cached.items });
        if (Date.now() - cached.ts > LIST_SILENT_REFRESH_AFTER) {
          void get().loadList(true);
        }
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
    set({ active: { ...item, kind: resolveWallpaperKind(item) } });
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
      set({ active: { ...item, kind: resolveWallpaperKind(item) } });
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
