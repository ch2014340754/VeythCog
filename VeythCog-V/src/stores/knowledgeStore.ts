/**
 * 知识库 store
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KnowledgeBase, Note } from '@/types';

interface KnowledgeState {
  bases: KnowledgeBase[];
  currentBaseId: string | null;
  notes: Note[];

  setBases: (list: KnowledgeBase[]) => void;
  setCurrentBase: (id: string | null) => void;
  addNote: (n: Note) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  removeNote: (id: string) => void;
}

export const useKnowledgeStore = create<KnowledgeState>()(
  persist(
    (set) => ({
      bases: [],
      currentBaseId: null,
      notes: [],

      setBases: (list) => set({ bases: list }),
      setCurrentBase: (id) => set({ currentBaseId: id }),
      addNote: (n) => set((s) => ({ notes: [n, ...s.notes] })),
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    { name: 'mywork:knowledge' }
  )
);
