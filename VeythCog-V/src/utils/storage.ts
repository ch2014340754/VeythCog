/**
 * 本地持久化封装
 * 命名空间隔离 + JSON 序列化 + 过期时间
 *
 * 用法：
 *   storage.set('chat:conversations', [...], { ttl: 7 * 24 * 3600 })
 *   storage.get<Conversation[]>('chat:conversations')
 */

const PREFIX = 'mywork:';

interface StorageEntry<T> {
  v: T;
  exp?: number; // 过期时间戳（ms），undefined 表示永久
}

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as StorageEntry<T>;
      if (entry.exp && entry.exp < Date.now()) {
        localStorage.removeItem(PREFIX + key);
        return null;
      }
      return entry.v;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T, opts?: { ttl?: number /* 秒 */ }): void {
    const entry: StorageEntry<T> = { v: value };
    if (opts?.ttl) entry.exp = Date.now() + opts.ttl * 1000;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // 磁盘满或隐私模式，静默失败
    }
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },

  /** 清掉当前应用的所有 key */
  clear(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  },
};
