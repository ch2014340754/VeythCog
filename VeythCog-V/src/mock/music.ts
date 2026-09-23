/**
 * 音乐播放器 mock 数据
 * 后期接后端时替换为真实歌单接口
 *
 * 当前使用 SoundHelix 公开示例音频做真实播放验证
 */

export interface MockTrack {
  id: string;
  title: string;
  artist: string;
  /** 时长（秒），加载后会被真实 metadata 覆盖 */
  duration: number;
  /** 封面渐变（mock 阶段不用真实图片，用双色渐变 + 首字母） */
  cover: [string, string];
  /** 音频地址 */
  url: string;
}

export const mockTracks: MockTrack[] = [
  {
    id: 't1',
    title: 'Midnight Train',
    artist: 'SoundHelix',
    duration: 245,
    cover: ['#7C3AED', '#06B6D4'],
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 't2',
    title: 'Ocean Room',
    artist: 'SoundHelix',
    duration: 260,
    cover: ['#059669', '#FBBF24'],
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 't3',
    title: 'City Wander',
    artist: 'SoundHelix',
    duration: 220,
    cover: ['#E11D48', '#FBBF24'],
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
  {
    id: 't4',
    title: 'Rainy Day',
    artist: 'SoundHelix',
    duration: 235,
    cover: ['#4F46E5', '#22D3EE'],
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    id: 't5',
    title: 'Starlit Post',
    artist: 'SoundHelix',
    duration: 250,
    cover: ['#D97706', '#EF4444'],
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  },
];

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
