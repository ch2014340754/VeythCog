import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import playIcon from '@iconify-icons/lucide/play';
import pauseIcon from '@iconify-icons/lucide/pause';
import skipBackIcon from '@iconify-icons/lucide/skip-back';
import skipForwardIcon from '@iconify-icons/lucide/skip-forward';
import chevronRightIcon from '@iconify-icons/lucide/chevron-right';
import chevronLeftIcon from '@iconify-icons/lucide/chevron-left';
import volume2Icon from '@iconify-icons/lucide/volume-2';
import volumeXIcon from '@iconify-icons/lucide/volume-x';
import listMusicIcon from '@iconify-icons/lucide/list-music';
import { useMusicStore } from '@/stores/musicStore';
import { mockTracks, formatTime } from '@/mock/music';

const CARD_WIDTH = 340;
const HANDLE_WIDTH = 20;
const CARD_HEIGHT = 150; // 不含播放列表，用于拖动范围/弹层方向计算

/**
 * 全局浮动音乐播放器
 * - 玻璃层与配色全部走 --glass-* / --color-* 变量，与全站毛玻璃一致
 * - 右边缘竖条把手：按住上下拖动位置；单击收起/展开
 * - 播放列表根据播放器位置自动向上或向下弹出
 * - 真音频播放（audio 元素），含音量、播放列表
 */
const FloatingMusicPlayer: React.FC = () => {
  /** 固定模式：true=始终展开不自动收起（左箭头）；false=鼠标移开自动隐藏（右箭头） */
  const pinned = useMusicStore((s) => s.pinned);
  const openMusic = useMusicStore((s) => s.open);
  const closeMusic = useMusicStore((s) => s.close);
  /** 外部入口（首页工具条）触发的展开 */
  const opened = useMusicStore((s) => s.opened);
  const [hovered, setHovered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(mockTracks[0].duration);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 自动收起定时器：光标离开播放器后延迟收起，给"滑向弹出列表"留出过渡时间 */
  const hideTimerRef = useRef<number | null>(null);

  const cancelAutoHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleAutoHide = () => {
    cancelAutoHide();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setHovered(false);
    }, 200);
  };

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const track = mockTracks[currentIndex];
  const expanded = pinned || hovered || opened;

  // 初始化 audio
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || track.duration);
    const onEnded = () => setCurrentIndex((i) => (i + 1) % mockTracks.length);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切歌：换源并自动播放
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = track.url;
    setCurrentTime(0);
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // 播放/暂停同步
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  // 音量/静音同步
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  const playPrev = () => setCurrentIndex((i) => (i - 1 + mockTracks.length) % mockTracks.length);
  const playNext = () => setCurrentIndex((i) => (i + 1) % mockTracks.length);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
    setCurrentTime(audio.currentTime);
  };

  // ===== 竖条把手：拖动 + 点击收起 =====
  const onHandleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const startOffset = offsetY;
    let moved = false;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > 3) moved = true;
      if (!moved) return;
      // 鼠标向下移（dy>0）→ 播放器向下走（bottom 减小，offsetY 减小）
      const next = startOffset - dy;
      const maxUp = -(window.innerHeight - CARD_HEIGHT - 100);
      const minDown = 80;
      setOffsetY(Math.max(maxUp, Math.min(minDown, next)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // 没拖动 → 点击切换 固定/自动隐藏；取消固定时一并清掉外部展开态，保证能收起
      if (!moved) {
        if (pinned) closeMusic();
        else openMusic();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 播放列表弹向：上方空间够就向上弹，否则向下弹
  const spaceAbove = window.innerHeight - (80 + offsetY) - CARD_HEIGHT;
  const listUpward = spaceAbove >= 260;

  // 收起时强制隐藏列表
  const playlistOpen = showPlaylist && expanded;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const initial = track.title.charAt(0);

  return (
    <div
      className={'vc-player' + (dragging ? ' is-dragging' : '')}
      style={{ bottom: `calc(80px + ${offsetY}px)` }}
      onMouseLeave={scheduleAutoHide}
      onMouseEnter={cancelAutoHide}
    >
      {/* 卡片本体 */}
      <div
        className={'vc-player__card' + (expanded ? '' : ' is-collapsed')}
        style={{ width: CARD_WIDTH }}
      >
        {/* 收起态：左边缘高亮提示条（这条边响应 hover，点击固定） */}
        {!expanded && (
          <button
            type="button"
            className="vc-player__peek"
            onMouseEnter={() => setHovered(true)}
            onClick={() => openMusic()}
            title="点击固定播放器（不再自动隐藏）"
            aria-label="展开播放器"
          >
            <Icon icon={chevronRightIcon} width={16} />
          </button>
        )}

        {/* 顶部：封面 + 歌名（纯展示，不拖） */}
        <div className="vc-player__head">
          <div
            className="vc-player__cover"
            style={{ background: `linear-gradient(135deg, ${track.cover[0]}, ${track.cover[1]})` }}
          >
            {initial}
          </div>
          <div className="vc-player__meta">
            <div className="vc-player__title">{track.title}</div>
            <div className="vc-player__artist">{track.artist}</div>
          </div>
        </div>

        {/* 控制行 */}
        <div className="vc-player__controls">
          <button type="button" className="vc-player__skip" onClick={playPrev} aria-label="上一首">
            <Icon icon={skipBackIcon} width={22} />
          </button>
          <button
            type="button"
            className="vc-player__play"
            onClick={() => setIsPlaying((v) => !v)}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            <Icon icon={isPlaying ? pauseIcon : playIcon} width={20} style={{ marginLeft: isPlaying ? 0 : 2 }} />
          </button>
          <button type="button" className="vc-player__skip" onClick={playNext} aria-label="下一首">
            <Icon icon={skipForwardIcon} width={22} />
          </button>

          {/* 音量 */}
          <div className="vc-player__volume">
            <button
              type="button"
              className="vc-player__mute"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? '取消静音' : '静音'}
            >
              <Icon icon={muted || volume === 0 ? volumeXIcon : volume2Icon} width={20} />
            </button>
            <input
              className="vc-player__range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (v > 0) setMuted(false);
              }}
              aria-label="音量"
            />
          </div>

          {/* 播放列表 */}
          <button
            type="button"
            className={'vc-player__icon-btn' + (playlistOpen ? ' is-on' : '')}
            onClick={() => setShowPlaylist((v) => !v)}
            aria-label="播放列表"
          >
            <Icon icon={listMusicIcon} width={22} />
          </button>
        </div>

        {/* 进度条 */}
        <div className="vc-player__progress-row">
          <div className="vc-player__progress" onClick={seek}>
            <div className="vc-player__progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="vc-player__times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 播放列表（根据位置向上或向下弹出） */}
        {playlistOpen && (
          <div
            className={'vc-player__list' + (listUpward ? ' is-up' : '')}
            style={listUpward ? { bottom: '100%' } : { top: '100%' }}
          >
            <div className="vc-player__list-head">播放列表 · {mockTracks.length} 首</div>
            {mockTracks.map((t, i) => {
              const active = i === currentIndex;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setCurrentIndex(i)}
                  className={'vc-player__track' + (active ? ' is-active' : '')}
                >
                  <div
                    className="vc-player__track-cover"
                    style={{ background: `linear-gradient(135deg, ${t.cover[0]}, ${t.cover[1]})` }}
                  >
                    {t.title.charAt(0)}
                  </div>
                  <div className="vc-player__track-title">
                    {t.title}
                    {active && isPlaying && <span className="vc-player__track-eq">♪</span>}
                  </div>
                  <div className="vc-player__track-dur">{formatTime(t.duration)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 右边缘竖条把手：仅展开时显示，承担拖动 + 点击切换固定/自动隐藏 */}
      <div
        className="vc-player__handle"
        onMouseDown={expanded ? onHandleMouseDown : undefined}
        role="button"
        aria-label={pinned ? '取消固定播放器' : '固定播放器'}
        title={
          expanded
            ? pinned
              ? '已固定：点击恢复自动隐藏（按住可拖动位置）'
              : '自动隐藏：点击固定播放器（按住可拖动位置）'
            : undefined
        }
        style={{ width: expanded ? HANDLE_WIDTH : 0 }}
      >
        <Icon icon={pinned ? chevronLeftIcon : chevronRightIcon} width={18} />
      </div>
    </div>
  );
};

export default FloatingMusicPlayer;
