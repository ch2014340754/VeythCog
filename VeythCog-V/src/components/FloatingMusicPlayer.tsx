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
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMusicStore } from '@/stores/musicStore';
import { mockTracks, formatTime } from '@/mock/music';

const CARD_WIDTH = 340;
const HANDLE_WIDTH = 20;
const CARD_HEIGHT = 150; // 不含播放列表，用于拖动范围/弹层方向计算

/**
 * 全局浮动音乐播放器
 * - 毛玻璃质感，颜色跟随主题
 * - 右边缘竖条把手：按住上下拖动位置；单击收起/展开
 * - 播放列表根据播放器位置自动向上或向下弹出
 * - 真音频播放（audio 元素），含音量、播放列表
 */
const FloatingMusicPlayer: React.FC = () => {
  const { colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
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
      style={{
        position: 'fixed',
        right: 0,
        bottom: `calc(80px + ${offsetY}px)`,
        zIndex: 'var(--z-fixed, 1000)',
        display: 'flex',
        alignItems: 'stretch',
        filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))',
        userSelect: dragging ? 'none' : 'auto',
      }}
      onMouseLeave={scheduleAutoHide}
      onMouseEnter={cancelAutoHide}
    >
      {/* 卡片本体 */}
      <div
        className="glass-effect"
        style={{
          width: CARD_WIDTH,
          flexShrink: 0,
          background: colors.glassBg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: '16px 0 0 16px',
          padding: 14,
          position: 'relative',
          transform: expanded ? 'translateX(0)' : 'translateX(calc(100% - 22px))',
          transition: `transform 0.35s var(--spring, cubic-bezier(0.22, 1, 0.36, 1))`,
          overflow: 'visible',
        }}
      >
        {/* 收起态：左边缘高亮提示条（这条边响应 hover，点击固定） */}
        {!expanded && (
          <div
            onMouseEnter={() => setHovered(true)}
            onClick={() => openMusic()}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 22,
              background: colors.primary15,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${colors.glassBorder}`,
              borderRadius: '16px 0 0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.primary,
              cursor: 'pointer',
              boxShadow: `inset 0 0 12px ${colors.primary10}`,
            }}
            title="点击固定播放器（不再自动隐藏）"
          >
            <Icon icon={chevronRightIcon} width={16} />
          </div>
        )}
        {/* 顶部：封面 + 歌名（纯展示，不拖） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: `1px solid ${colors.divider}` }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${track.cover[0]}, ${track.cover[1]})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 20,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: colors.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {track.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {track.artist}
            </div>
          </div>
        </div>

        {/* 控制行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
          <Icon
            icon={skipBackIcon}
            width={24}
            color={colors.text}
            style={{ cursor: 'pointer', padding: 4 }}
            onClick={playPrev}
          />
          <div
            onClick={() => setIsPlaying((v) => !v)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: colors.primary,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              margin: '0 6px',
              boxShadow: `0 4px 12px ${colors.primary40}`,
            }}
          >
            <Icon icon={isPlaying ? pauseIcon : playIcon} width={20} style={{ marginLeft: isPlaying ? 0 : 2 }} />
          </div>
          <Icon
            icon={skipForwardIcon}
            width={24}
            color={colors.text}
            style={{ cursor: 'pointer', padding: 4 }}
            onClick={playNext}
          />

          {/* 音量 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10, flex: 1 }}>
            <Icon
              icon={muted || volume === 0 ? volumeXIcon : volume2Icon}
              width={22}
              color={colors.text}
              style={{ cursor: 'pointer', padding: 2 }}
              onClick={() => setMuted((v) => !v)}
            />
            <input
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
              style={{ width: 70, accentColor: colors.primary, cursor: 'pointer' }}
            />
          </div>

          {/* 播放列表 */}
          <Icon
            icon={listMusicIcon}
            width={24}
            color={playlistOpen ? colors.primary : colors.text}
            style={{ cursor: 'pointer', padding: 4 }}
            onClick={() => setShowPlaylist((v) => !v)}
          />
        </div>

        {/* 进度条 */}
        <div style={{ marginTop: 10 }}>
          <div
            onClick={seek}
            style={{
              height: 6,
              borderRadius: 3,
              background: colors.divider,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: colors.primary,
                borderRadius: 3,
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: colors.textTertiary,
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 播放列表（根据位置向上或向下弹出） */}
        {playlistOpen && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: HANDLE_WIDTH,
              ...(listUpward
                ? { bottom: '100%', top: 'auto', marginBottom: 8 }
                : { top: '100%', bottom: 'auto', marginTop: 8 }),
              background: colors.surfaceElevated,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${colors.glassBorder}`,
              borderRadius: 12,
              maxHeight: 220,
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 10,
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: colors.textSecondary,
                letterSpacing: 0.5,
                borderBottom: `1px solid ${colors.divider}`,
                position: 'sticky',
                [listUpward ? 'bottom' : 'top']: 0,
                background: colors.surfaceElevated,
              } as React.CSSProperties}
            >
              播放列表 · {mockTracks.length} 首
            </div>
            {mockTracks.map((t, i) => {
              const active = i === currentIndex;
              return (
                <div
                  key={t.id}
                  onClick={() => setCurrentIndex(i)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    background: active ? colors.primary10 : 'transparent',
                    color: active ? colors.primary : colors.text,
                    transition: `background 0.15s`,
                    backdropFilter: active && glassEnabled ? 'blur(6px) saturate(160%)' : undefined,
                    WebkitBackdropFilter: active && glassEnabled ? 'blur(6px) saturate(160%)' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = colors.primary10;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      background: `linear-gradient(135deg, ${t.cover[0]}, ${t.cover[1]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {t.title.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t.title}
                      {active && isPlaying && (
                        <span style={{ marginLeft: 6, color: colors.primary }}>♪</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(t.duration)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 右边缘竖条把手：仅展开时显示，承担拖动 + 点击切换固定/自动隐藏 */}
      <div
        onMouseDown={expanded ? onHandleMouseDown : undefined}
        title={
          expanded
            ? pinned
              ? '已固定：点击恢复自动隐藏（按住可拖动位置）'
              : '自动隐藏：点击固定播放器（按住可拖动位置）'
            : undefined
        }
        style={{
          width: expanded ? HANDLE_WIDTH : 0,
          flexShrink: 0,
          overflow: 'hidden',
          background: colors.primary,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragging ? 'grabbing' : 'grab',
          color: '#fff',
          border: `1px solid ${colors.glassBorder}`,
          borderLeft: 'none',
          borderRadius: '0',
          transition: `width 0.3s var(--spring, cubic-bezier(0.22, 1, 0.36, 1)), background 0.2s`,
        }}
      >
        <Icon icon={pinned ? chevronLeftIcon : chevronRightIcon} width={18} />
      </div>
    </div>
  );
};

export default FloatingMusicPlayer;
