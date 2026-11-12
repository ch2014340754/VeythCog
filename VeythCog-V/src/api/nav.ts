/**
 * 导航首页 API（iTab 风格新标签页）
 */
import { http, uploadFile } from './client';

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
export const getAllBookmarks = () =>
  http.get<NavBookmark[]>('/nav/bookmarks/all');

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

export const createBookmark = (data: BookmarkSaveInput & { categoryId: number }) =>
  http.post<number>('/nav/bookmarks', data);

export const updateBookmark = (id: number, data: BookmarkSaveInput) =>
  http.put<void>(`/nav/bookmarks/${id}`, data);

export const deleteBookmark = (id: number) =>
  http.del<void>(`/nav/bookmarks/${id}`);

export const reorderBookmarks = (categoryId: number, items: { id: number; sortOrder: number }[]) =>
  http.put<void>('/nav/bookmarks/reorder', { categoryId, items });

// ============ 壁纸 ============

export const getRandomWallpaper = () =>
  http.get<WallpaperItem | null>('/nav/wallpaper/random');

export const listWallpapers = () =>
  http.get<WallpaperItem[]>('/nav/wallpaper/list');

export const lockWallpaper = (key: string | null) =>
  http.put<void>('/nav/wallpaper/lock', { key });

/** 当前用户锁定的壁纸（未设置返回 null） */
export const getCurrentWallpaper = () =>
  http.get<WallpaperItem | null>('/nav/wallpaper/current');

// ============ 配置 ============

export const getNavSetting = () =>
  http.get<NavSetting>('/nav/setting');

export const updateNavSetting = (data: { searchEngine?: string; activeCategoryId?: number }) =>
  http.put<void>('/nav/setting', data);
