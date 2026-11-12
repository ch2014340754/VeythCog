/**
 * 导航书签图标描述缓存（localStorage）。
 *
 * 只缓存「图标地址 / 文字 / 颜色」这类轻量描述，不缓存图片字节：
 * - 图片由浏览器按 S3 公开直链自行缓存；
 * - 描述缓存用于首页首屏直接渲染，避免每次开新标签页都向 DB 要一遍图标地址。
 *
 * 失效规则：书签的图标字段（iconType/iconKey/iconText/iconColor/iconSyncedAt/hasIcon）
 * 任一项变化，签名即变化，视为未命中；另外 30 天兜底过期。
 */
import type { NavBookmark, NavIcon } from '@/api/nav';

const STORAGE_KEY = 'veythcog:nav-icons:v1';

/** 最多保留多少条，超出按最久未用淘汰 */
const MAX_ENTRIES = 300;

/** 描述缓存兜底 TTL：30 天 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  /** 图标字段签名 */
  sig: string;
  /** 解析结果 */
  icon: NavIcon;
  /** 最近写入时间 */
  ts: number;
}

type CacheStore = Record<string, CacheEntry>;

function readStore(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as CacheStore;
  } catch {
    // localStorage 不可用 / 内容坏了都当空缓存
  }
  return {};
}

function writeStore(store: CacheStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 配额满 / 隐私模式：静默降级为无缓存
  }
}

/** 书签图标字段签名：任一项变化都让旧缓存失效 */
export function iconSignature(bookmark: NavBookmark): string {
  return [
    bookmark.iconType ?? 'auto',
    bookmark.iconKey ?? '',
    bookmark.iconText ?? '',
    bookmark.iconColor ?? '',
    bookmark.iconSyncedAt ?? '',
    bookmark.hasIcon ? '1' : '0',
  ].join('|');
}

export function getCachedIcon(bookmark: NavBookmark): NavIcon | null {
  const store = readStore();
  const key = String(bookmark.id);
  const entry = store[key];
  if (!entry) return null;
  if (entry.sig !== iconSignature(bookmark) || Date.now() - entry.ts > TTL_MS) {
    delete store[key];
    writeStore(store);
    return null;
  }
  return entry.icon;
}

export function setCachedIcon(bookmark: NavBookmark, icon: NavIcon): void {
  const store = readStore();
  const key = String(bookmark.id);
  store[key] = { sig: iconSignature(bookmark), icon, ts: Date.now() };

  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => store[a].ts - store[b].ts)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((oldKey) => delete store[oldKey]);
  }
  writeStore(store);
}

/** 书签保存 / 删除后清掉对应缓存，下次渲染会重新解析 */
export function clearCachedIcon(id: number): void {
  const store = readStore();
  const key = String(id);
  if (store[key]) {
    delete store[key];
    writeStore(store);
  }
}
