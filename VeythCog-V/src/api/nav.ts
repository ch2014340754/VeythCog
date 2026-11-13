/**
 * 导航首页 API（iTab 风格新标签页）
 */
import { apiUrl, http, uploadFile } from './client';

// ============ 类型 ============

export type NavIconType = 'auto' | 'upload' | 'text';

export interface NavCategory {
  id: number;
  userId: number;
  name: string;
  icon: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NavBookmark {
  id: number;
  categoryId: number;
  userId: number;
  title: string;
  url: string;
  sortOrder: number;
  /** 图标来源：auto 站点抓取 / upload 自定义上传 / text 文字图标 */
  iconType?: NavIconType;
  /** public-icons 对象 key（编辑时原样回传，避免丢图标） */
  iconKey?: string | null;
  /** 文字图标内容（1~3 字符） */
  iconText?: string | null;
  /** 文字图标底色 */
  iconColor?: string | null;
  iconSyncedAt?: string | null;
  /** 是否已有 S3 图标对象 */
  hasIcon?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** 图标解析结果：url 为 S3 公开直链，文字图标为 null */
export interface NavIcon {
  type: NavIconType;
  url?: string | null;
  text?: string | null;
  color?: string | null;
}

/** 获取 / 上传图标后的结果 */
export interface IconUploadResult {
  iconKey: string;
  iconUrl: string;
  title?: string | null;
  sourceUrl?: string | null;
}

export interface IconSyncResult {
  total: number;
  success: number;
  failed: number;
}

/** 新建 / 更新书签的图标字段 */
export interface BookmarkSaveInput {
  categoryId?: number;
  title: string;
  url: string;
  iconType: NavIconType;
  iconKey?: string | null;
  iconText?: string | null;
  iconColor?: string | null;
}

export interface NavSetting {
  userId: number;
  searchEngine: 'baidu' | 'google' | 'bing';
  currentWallpaperKey: string | null;
  activeCategoryId: number | null;
  updatedAt?: string;
}

export interface WallpaperItem {
  key: string;
  url: string;
  /** 服务端判定的壁纸类型；老接口/缓存里可能缺失，前端会按后缀回退 */
  kind?: 'image' | 'video';
}

/** 首页启动聚合数据：一个请求拿齐配置、分类、当前分类书签和当前壁纸 */
export interface NavBootstrap {
  setting: NavSetting;
  categories: NavCategory[];
  activeCategoryId: number | null;
  bookmarks: NavBookmark[];
  wallpaper: WallpaperItem | null;
}

// ============ 分类 ============

export const getCategories = () =>
  http.get<NavCategory[]>('/nav/categories');

export const createCategory = (data: { name: string; icon?: string }) =>
  http.post<number>('/nav/categories', data);

export const updateCategory = (id: number, data: { name: string; icon?: string }) =>
  http.put<void>(`/nav/categories/${id}`, data);

export const deleteCategory = (id: number) =>
  http.del<void>(`/nav/categories/${id}`);

export const reorderCategories = (items: { id: number; sortOrder: number }[]) =>
  http.put<void>('/nav/categories/reorder', { items });

export const setDefaultCategory = (id: number) =>
  http.put<void>(`/nav/categories/${id}/default`);

// ============ 书签 ============

export const getBookmarks = (categoryId: number) =>
  http.get<NavBookmark[]>('/nav/bookmarks', { categoryId });

/** 全量书签：搜索框本地联想一次拉取 */
let allBookmarksCache: { items: NavBookmark[]; at: number } | null = null;
let allBookmarksInFlight: Promise<NavBookmark[]> | null = null;
const ALL_BOOKMARKS_TTL = 5 * 60 * 1000;

function invalidateAllBookmarksCache() {
  allBookmarksCache = null;
  allBookmarksInFlight = null;
}

/**
 * 全量书签：搜索联想使用。
 * - 5 分钟内命中缓存，不再请求；
 * - 并发调用复用同一个 Promise（dev StrictMode 也不会发两遍）。
 */
export const getAllBookmarks = (force = false): Promise<NavBookmark[]> => {
  if (!force && allBookmarksCache && Date.now() - allBookmarksCache.at < ALL_BOOKMARKS_TTL) {
    return Promise.resolve(allBookmarksCache.items);
  }
  if (!force && allBookmarksInFlight) return allBookmarksInFlight;

  const request = http.get<NavBookmark[]>('/nav/bookmarks/all')
    .then((list) => {
      const items = list ?? [];
      allBookmarksCache = { items, at: Date.now() };
      return items;
    })
    .finally(() => {
      if (allBookmarksInFlight === request) allBookmarksInFlight = null;
    });
  allBookmarksInFlight = request;
  return request;
};

/** 解析单个书签图标：前端缓存未命中时调用 */
export const getBookmarkIcon = (id: number) =>
  http.get<NavIcon>(`/nav/bookmarks/${id}/icon`);

/** 从网址获取站点图标并上传 S3 */
export const fetchSiteIcon = (url: string) =>
  http.post<IconUploadResult>('/nav/icons/fetch', { url });

/** 上传自定义图标（png/jpg/webp/gif/ico，≤512KB） */
export const uploadIcon = (file: File) =>
  uploadFile<IconUploadResult>('/nav/icons/upload', file);

/** 补齐当前用户缺失的站点图标 */
export const syncIcons = () =>
  http.post<IconSyncResult>('/nav/icons/sync');

export const createBookmark = async (data: BookmarkSaveInput & { categoryId: number }) => {
  const id = await http.post<number>('/nav/bookmarks', data);
  invalidateAllBookmarksCache();
  return id;
};

export const updateBookmark = async (id: number, data: BookmarkSaveInput) => {
  await http.put<void>(`/nav/bookmarks/${id}`, data);
  invalidateAllBookmarksCache();
};

export const deleteBookmark = async (id: number) => {
  await http.del<void>(`/nav/bookmarks/${id}`);
  invalidateAllBookmarksCache();
};

export const reorderBookmarks = async (categoryId: number, items: { id: number; sortOrder: number }[]) => {
  await http.put<void>('/nav/bookmarks/reorder', { categoryId, items });
  invalidateAllBookmarksCache();
};

// ============ 壁纸 ============

export const getRandomWallpaper = () =>
  http.get<WallpaperItem | null>('/nav/wallpaper/random');

export const listWallpapers = () =>
  http.get<WallpaperItem[]>('/nav/wallpaper/list');

/**
 * 动态壁纸视频地址：后端同源代理（支持 Range），不能直接用清单里的 S3 预签名地址。
 * 对象存储对带 Range 的预签名请求会重置连接，浏览器 <video> 的首帧请求正好走 Range。
 */
export const wallpaperVideoUrl = (key: string) =>
  apiUrl('/nav/wallpaper/video', { key });

export const lockWallpaper = (key: string | null) =>
  http.put<void>('/nav/wallpaper/lock', { key });

/** 当前用户锁定的壁纸（未设置返回 null） */
export const getCurrentWallpaper = () =>
  http.get<WallpaperItem | null>('/nav/wallpaper/current');

// ============ 配置 ============

/** 首页启动数据：setting + categories + 当前分类 bookmarks + current wallpaper */
const bootstrapInFlight = new Map<string, Promise<NavBootstrap>>();
export const getNavBootstrap = (categoryId?: number | null): Promise<NavBootstrap> => {
  const key = categoryId == null ? 'default' : String(categoryId);
  const existing = bootstrapInFlight.get(key);
  if (existing) return existing;
  const request = http
    .get<NavBootstrap>('/nav/bootstrap', categoryId != null ? { categoryId } : undefined)
    .finally(() => {
      if (bootstrapInFlight.get(key) === request) bootstrapInFlight.delete(key);
    });
  bootstrapInFlight.set(key, request);
  return request;
};

export const getNavSetting = () =>
  http.get<NavSetting>('/nav/setting');

export const updateNavSetting = (data: { searchEngine?: string; activeCategoryId?: number }) =>
  http.put<void>('/nav/setting', data);
