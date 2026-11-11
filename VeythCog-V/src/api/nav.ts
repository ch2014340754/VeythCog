/**
 * 导航首页 API（iTab 风格新标签页）
 */
import { http } from './client';

// ============ 类型 ============

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
  createdAt?: string;
  updatedAt?: string;
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

export const createBookmark = (data: { categoryId: number; title: string; url: string }) =>
  http.post<number>('/nav/bookmarks', data);

export const updateBookmark = (id: number, data: { title: string; url: string; categoryId?: number }) =>
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
