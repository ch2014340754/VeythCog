/**
 * 全局音乐播放器状态。
 *
 * - pinned：固定展开，鼠标移开不自动收起（播放器把手点击切换）
 * - opened：由外部入口（首页底部工具条）触发的展开；open() 同时固定，避免滑走
 * - tracks：最近一次拉取的曲库列表（播放器播放列表的数据源，静默刷新只覆盖这一份）
 * - pickerOpen：歌单弹窗（首页底部 Dock / 其它入口触发）
 * - playRequest：外部点歌信号，播放器监听后直接换源播放
 * - currentId：播放器回写的当前曲目 id，供歌单弹窗高亮
 * - ambientOn / ambientVolume：背景音偏好（**唯一需要持久化**的两项）
 *
 * 播放器组件在 App 全局挂载一次，首页 / 站内页面共用同一实例。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MusicTrack } from '@/api/music';

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

  /** 曲库缓存（播放器 / 音乐库页共用） */
  tracks: MusicTrack[];
  /** 最近一次成功拉取列表的时间（epoch ms），用于静默刷新节流 */
  tracksLoadedAt: number;
  setTracks: (tracks: MusicTrack[]) => void;

  /** 背景音模式开关（持久化：下次打开页面延续） */
  ambientOn: boolean;
  /** 背景音音量（持久化，固定 0.25 起步） */
  ambientVolume: number;
  setAmbientOn: (v: boolean) => void;
  setAmbientVolume: (v: number) => void;

  /** 歌单弹窗开关（不持久化，关闭页面即复位） */
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;

  /**
   * 点歌信号：调用即请求播放指定曲目。
   * 带 at 时间戳而不是只存 id —— 连续点同一首歌也要能重新起播。
   */
  playRequest: { id: number | string; at: number } | null;
  requestPlay: (id: number | string) => void;

  /** 当前播放曲目 id（播放器回写，歌单弹窗据此显示「正在播放」） */
  currentId: number | string | null;
  setCurrentId: (id: number | string | null) => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set) => ({
      pinned: false,
      opened: false,
      setPinned: (v) => set({ pinned: v }),
      open: () => set({ opened: true, pinned: true }),
      close: () => set({ opened: false, pinned: false }),

      tracks: [],
      tracksLoadedAt: 0,
      setTracks: (tracks) => set({ tracks, tracksLoadedAt: Date.now() }),

      ambientOn: false,
      ambientVolume: 0.25,
      setAmbientOn: (v) => set({ ambientOn: v }),
      setAmbientVolume: (v) => set({ ambientVolume: Math.max(0, Math.min(1, v)) }),

      pickerOpen: false,
      setPickerOpen: (v) => set({ pickerOpen: v }),

      playRequest: null,
      requestPlay: (id) => set({ playRequest: { id, at: Date.now() } }),

      currentId: null,
      setCurrentId: (id) => set({ currentId: id }),
    }),
    {
      name: 'veythcog:music',
      // 只持久化背景音偏好：pinned / opened 是交互瞬时态，曲库列表每次进页面重新拉取
      partialize: (state) => ({ ambientOn: state.ambientOn, ambientVolume: state.ambientVolume }),
    },
  ),
);
