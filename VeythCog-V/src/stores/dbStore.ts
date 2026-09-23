/**
 * 数据库连接 store
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DBConnection } from '@/types';

interface DbState {
  connections: DBConnection[];
  currentConnId: string | null;

  addConnection: (c: DBConnection) => void;
  updateConnection: (id: string, patch: Partial<DBConnection>) => void;
  removeConnection: (id: string) => void;
  setCurrent: (id: string | null) => void;
}

export const useDbStore = create<DbState>()(
  persist(
    (set) => ({
      connections: [],
      currentConnId: null,

      addConnection: (c) => set((s) => ({ connections: [...s.connections, c] })),
      updateConnection: (id, patch) =>
        set((s) => ({
          connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeConnection: (id) =>
        set((s) => ({
          connections: s.connections.filter((c) => c.id !== id),
          currentConnId: s.currentConnId === id ? null : s.currentConnId,
        })),
      setCurrent: (id) => set({ currentConnId: id }),
    }),
    { name: 'mywork:db' }
  )
);
