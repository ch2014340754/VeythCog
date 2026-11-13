/**
 * 全局音乐播放器状态（轻量，不持久化）。
 *
 * - pinned：固定展开，鼠标移开不自动收起（播放器把手点击切换）
 * - opened：由外部入口（首页底部工具条）触发的展开；open() 同时固定，避免滑走
 *
 * 播放器组件在 App 全局挂载一次，首页 / 站内页面共用同一实例。
 */
import { create } from 'zustand';

interface MusicState {
  /** 固定展开 */
  pinned: boolean;
  /** 外部入口触发展开 */
  opened: boolean;
  setPinned: (v: boolean) => void;
  /** 外部入口打开：展开并固定 */
  open: () => void;
  /** 外部入口关闭：收起并取消固定 */
  close: () => void;
}

export const useMusicStore = create<MusicState>((set) => ({
  pinned: false,
  opened: false,
  setPinned: (v) => set({ pinned: v }),
  open: () => set({ opened: true, pinned: true }),
  close: () => set({ opened: false, pinned: false }),
}));
