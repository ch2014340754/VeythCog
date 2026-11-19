/**
 * 用户偏好 API（统一表 user_setting）
 *
 * 所有「按用户保存的偏好」都走这两个接口：后端 /api/user/setting。
 * 新增偏好时后端加列 + 本文件加字段即可，不再新增接口。
 */
import { http } from './client';

export interface UserSetting {
  userId: number;
  searchEngine: 'baidu' | 'google' | 'bing';
  currentWallpaperKey: string | null;
  activeCategoryId: number | null;
  /** 首页默认视图：today / nav */
  homeView: 'today' | 'nav';
  updatedAt?: string;
}

/** 更新入参：字段省略 / null = 不修改；要清空必须写进 clear 白名单 */
export interface UserSettingPatch {
  searchEngine?: 'baidu' | 'google' | 'bing';
  activeCategoryId?: number;
  homeView?: 'today' | 'nav';
  clear?: Array<'activeCategoryId' | 'currentWallpaperKey'>;
}

export const getUserSetting = () => http.get<UserSetting>('/user/setting');

export const updateUserSetting = (patch: UserSettingPatch) =>
  http.put<UserSetting>('/user/setting', patch);
