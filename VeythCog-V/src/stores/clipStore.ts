/**
 * 收件箱待处理计数（导航角标用）。
 * 只做"尽量新"：进站拉一次、切页拉一次、60s 轮询一次；
 * 入库/删除后由调用方主动 refresh，角标立即跟上，不靠轮询兜底。
 */
import { create } from 'zustand';
import { getClipPendingCount } from '@/api/clip';

interface ClipState {
  pendingCount: number;
  refreshPending: () => Promise<void>;
  reset: () => void;
}

export const useClipStore = create<ClipState>((set) => ({
  pendingCount: 0,
  refreshPending: async () => {
    try {
      const count = await getClipPendingCount();
      set({ pendingCount: typeof count === 'number' ? count : 0 });
    } catch {
      // 未登录 / 后端未部署：角标保持旧值，不打扰用户
    }
  },
  reset: () => set({ pendingCount: 0 }),
}));
