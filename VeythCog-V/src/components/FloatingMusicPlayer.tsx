import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import radioIcon from '@iconify-icons/lucide/radio';
import { useMusicStore } from '@/stores/musicStore';
import { useModeStore } from '@/stores/modeStore';
import { listAmbientTracks, listTracks, type MusicTrack } from '@/api/music';
import { mockAsPlayerTracks, formatTime } from '@/mock/music';

const CARD_WIDTH = 340;
const HANDLE_WIDTH = 20;
const CARD_HEIGHT = 150; // 不含播放列表，用于拖动范围/弹层方向计算

/** 前台播放默认音量 20%（用户偏好：不打扰；音量只在本次会话内生效，不持久化） */
const DEFAULT_VOLUME = 0.2;

/** 背景音渐入 / 渐出时长（PRD §4.4） */
const AMBIENT_FADE_IN_MS = 3000;
const AMBIENT_FADE_OUT_MS = 1500;
/** 播流 token 5 分钟有效：每 3 分钟静默刷新一次列表换新签名 */
const TOKEN_REFRESH_MS = 3 * 60 * 1000;

/** 播放器内部统一曲目结构（API 曲目与 mock 曲目收敛成同一形状） */
interface PlayerTrack {
  id: string | number;
  title: string;
  artist: string;
  cover: [string, string];
  url: string;
  durationSec: number;
  ai: boolean;
}

const FALLBACK_COVER: [string, string] = ['#7C3AED', '#06B6D4'];

function toPlayerTrack(track: MusicTrack): PlayerTrack {
  const cover = track.coverColor;
  return {
    id: track.id,
    title: track.title,
    artist: track.artist || '未知艺人',
    cover: cover && cover.length >= 2 ? [cover[0], cover[1]] : FALLBACK_COVER,
    url: track.streamUrl,
    durationSec: Math.round((track.durationMs || 0) / 1000),
    ai: track.aiDisclosure,
  };
}

/**
 * 全局浮动音乐播放器
 * - 玻璃层与配色全部走 --glass-* / --color-* 变量，与全站毛玻璃一致
 * - 右边缘竖条把手：按住上下拖动位置；单击收起/展开
 * - 播放列表根据播放器位置自动向上或向下弹出
 * - 真音频播放：曲库来自 /music/tracks（audio 元素直连后端 Range 代理），
 *   背景音模式下播放 /music/ambient 池内曲目（低音量 + 渐入渐出 + 页面隐藏即暂停）
 */
const FloatingMusicPlayer: React.FC = () => {
  /** 固定模式：true=始终展开不自动收起（左箭头）；false=鼠标移开自动隐藏（右箭头） */
  const pinned = useMusicStore((s) => s.pinned);
  const openMusic = useMusicStore((s) => s.open);
  const closeMusic = useMusicStore((s) => s.close);
  /** 外部入口（首页工具条）触发的展开 */
  const opened = useMusicStore((s) => s.opened);
  const apiTracks = useMusicStore((s) => s.tracks);
  const setStoreTracks = useMusicStore((s) => s.setTracks);
  const ambientOn = useMusicStore((s) => s.ambientOn);
  const setAmbientOn = useMusicStore((s) => s.setAmbientOn);
  const ambientVolume = useMusicStore((s) => s.ambientVolume);
  const setAmbientVolume = useMusicStore((s) => s.setAmbientVolume);
  /** 歌单弹窗点歌信号 + 当前曲目回写（判断"正在播放"用） */
  const playRequest = useMusicStore((s) => s.playRequest);
  const setCurrentId = useMusicStore((s) => s.setCurrentId);
  const bypass = useModeStore((s) => s.bypassMode);

  const [ambientPool, setAmbientPool] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [hovered, setHovered] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 自动收起定时器：光标离开播放器后延迟收起，给“滑向弹出列表”留出过渡时间 */
  const hideTimerRef = useRef<number | null>(null);
  /** 渐入渐出 rAF 句柄 */
  const fadeRafRef = useRef<number | null>(null);
  /** 是否处于渐入渐出中（期间不要覆盖 volume） */
  const fadingRef = useRef(false);
  /** 当前已加载的曲目 id（避免列表刷新时重启正在播的音频） */
  const loadedIdRef = useRef<string>('');
  /** 上次播放位置（token 过期续播用） */
  const lastPosRef = useRef(0);
  /** 是否期望播放（用户意图；自动播放被浏览器拦截时保留意图） */
  const wantPlayRef = useRef(false);
  /** 自动播放被拦截，等首次用户手势再重试 */
  const pendingGestureRef = useRef(false);
  /** 已经因错误重试过一次的曲目 id（同一首歌只自动重试一次） */
  const retriedIdRef = useRef<string>('');
  /** 页面隐藏导致的暂停：恢复可见时按原播放意图继续 */
  const pausedByHiddenRef = useRef(false);
  /** 最新回调的引用：audio 事件监听只注册一次，读 ref 避免闭包过期 */
  const ambientOnRef = useRef(ambientOn);
  const poolRef = useRef<PlayerTrack[]>([]);
  const queueRef = useRef<PlayerTrack[]>([]);
  const indexRef = useRef(0);
  const volumeRef = useRef(volume);
  const ambientVolumeRef = useRef(ambientVolume);
  const handleErrorRef = useRef<() => void>(() => {});
  /** 换源播放的统一入口（ended / 错误恢复 / 背景音起播都通过 ref 调它，避免闭包过期） */
  const startTrackRef = useRef<((index: number, list: PlayerTrack[]) => void) | null>(null);
  /** 背景音池是否已就绪（未就绪时列表同步 effect 不抢跑） */
  const ambientPoolReadyRef = useRef(false);

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

  // 卸载时清理定时器 / rAF
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    };
  }, []);

  /** 联调模式（后端未部署）用 mock 曲库兜底；正常模式一律用接口数据，空就是空 */
  const mockQueue = useMemo(() => (bypass ? mockAsPlayerTracks() : []), [bypass]);

  /** 当前队列：背景音模式播池内曲目，否则播曲库 */
  const queue = useMemo<PlayerTrack[]>(() => {
    if (ambientOn) return bypass ? mockQueue : ambientPool;
    return bypass ? mockQueue : apiTracks.map(toPlayerTrack);
  }, [ambientOn, ambientPool, apiTracks, bypass, mockQueue]);

  const track = queue[Math.min(currentIndex, Math.max(0, queue.length - 1))] ?? null;
  const expanded = pinned || hovered || opened;

  // ===== 数据拉取 =====
  const fetchLibrary = useCallback(async (): Promise<PlayerTrack[] | null> => {
    if (bypass) return mockAsPlayerTracks();
    try {
      const page = await listTracks({ pageSize: 200, sortField: 'createdAt', sortOrder: 'descend' });
      setStoreTracks(page.records);
      return page.records.map(toPlayerTrack);
    } catch {
      // 静默：拉不到就保留上一次列表，播放中的音频不受影响
      return null;
    }
  }, [bypass, setStoreTracks]);

  const fetchAmbientPool = useCallback(async (): Promise<PlayerTrack[]> => {
    if (bypass) {
      const mock = mockAsPlayerTracks();
      setAmbientPool(mock);
      return mock;
    }
    try {
      const pool = await listAmbientTracks();
      const mapped = pool.map(toPlayerTrack);
      setAmbientPool(mapped);
      return mapped;
    } catch {
      setAmbientPool([]);
      return [];
    }
  }, [bypass]);

  useEffect(() => {
    fetchLibrary();
    const timer = window.setInterval(() => {
      fetchLibrary();
      if (ambientOnRef.current) fetchAmbientPool();
    }, TOKEN_REFRESH_MS);
    // 音乐库页增删改后派发该事件，播放器立刻静默同步（不必等 3 分钟轮询）
    const onChanged = () => {
      fetchLibrary();
      if (ambientOnRef.current) fetchAmbientPool();
    };
    window.addEventListener('veythcog:music-changed', onChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('veythcog:music-changed', onChanged);
    };
  }, [fetchLibrary, fetchAmbientPool]);

  // ===== 音量 / 渐入渐出 =====
  const applyVolume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || fadingRef.current) return;
    audio.volume = ambientOnRef.current ? ambientVolumeRef.current : volumeRef.current;
    audio.muted = muted;
  }, [muted]);

  const fadeTo = useCallback((target: number, durationMs: number, onDone?: () => void) => {
    const audio = audioRef.current;
    if (!audio) {
      onDone?.();
      return;
    }
    if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    const from = audio.muted ? 0 : audio.volume;
    const start = performance.now();
    fadingRef.current = true;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / Math.max(1, durationMs));
      if (!audio.muted) audio.volume = from + (target - from) * p;
      if (p < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        fadeRafRef.current = null;
        fadingRef.current = false;
        onDone?.();
      }
    };
    fadeRafRef.current = requestAnimationFrame(step);
  }, []);

  const tryPlay = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      await audio.play();
      setIsPlaying(true);
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // 浏览器自动播放策略拦截：保留播放意图，等首次手势重试（不打扰用户）
        pendingGestureRef.current = true;
      }
      setIsPlaying(false);
      return false;
    }
  }, []);

  const pauseAudio = useCallback((fade: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fade && !audio.paused) {
      fadeTo(0, AMBIENT_FADE_OUT_MS, () => {
        audio.pause();
        setIsPlaying(false);
      });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [fadeTo]);

  // ===== audio 初始化（只注册一次事件） =====
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = DEFAULT_VOLUME;
    audioRef.current = audio;

    const onTime = () => {
      setCurrentTime(audio.currentTime);
      lastPosRef.current = audio.currentTime;
    };
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onEnded = () => {
      const list = ambientOnRef.current ? poolRef.current : queueRef.current;
      if (list.length === 0) {
        setIsPlaying(false);
        return;
      }
      const nextIndex = (indexRef.current + 1) % list.length;
      // 由统一入口负责换源（见 startTrack）
      startTrackRef.current?.(nextIndex, list);
    };
    const onError = () => {
      // 播放地址带 5 分钟签名：过期后浏览器请求会 401，这里静默换新签名并从断点续播
      handleErrorRef.current();
    };
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.src = '';
    };
  }, []);

  // ref 同步（事件回调里读 ref，避免闭包拿到旧值）
  useEffect(() => {
    ambientOnRef.current = ambientOn;
  }, [ambientOn]);
  useEffect(() => {
    poolRef.current = ambientPool;
  }, [ambientPool]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    ambientVolumeRef.current = ambientVolume;
  }, [ambientVolume]);
  useEffect(() => {
    applyVolume();
  }, [applyVolume, volume, ambientVolume, ambientOn]);

  // ===== 换源播放（统一入口，避免多套 effect 互相打架） =====
  const startTrack = useCallback(
    (index: number, list: PlayerTrack[]) => {
      const audio = audioRef.current;
      const next = list[index];
      if (!audio || !next) return;
      // 背景音模式下自动循环，正常模式循环整库
      setCurrentIndex(index);
      indexRef.current = index;
      loadedIdRef.current = String(next.id);
      retriedIdRef.current = '';
      audio.src = next.url;
      setCurrentTime(0);
      lastPosRef.current = 0;
      setDuration(next.durationSec);
      setNotice(next.url ? '' : '该曲目暂不可播放');
      wantPlayRef.current = true;
      if (ambientOnRef.current) {
        // 背景音：从 0 渐入到 0.25，不打断正在听的内容
        audio.volume = 0;
        tryPlay().then((ok) => {
          if (ok) fadeTo(ambientVolumeRef.current, AMBIENT_FADE_IN_MS);
          else audio.volume = ambientVolumeRef.current;
        });
      } else {
        audio.volume = volumeRef.current;
        audio.muted = muted;
        tryPlay();
      }
    },
    [fadeTo, muted, tryPlay],
  );

  // 供 ended 回调使用（ref 里读最新实现）
  useEffect(() => {
    startTrackRef.current = startTrack;
  }, [startTrack]);

  // ===== 列表刷新后保持当前曲目：id 相同不换源；被删了才顺延到下一首 =====
  useEffect(() => {
    const audio = audioRef.current;
    const list = queue;
    if (!audio || !list.length) return;
    // 背景音池还在拉取时不要抢跑（起播由背景音开关的 effect 统一起）
    if (ambientOn && !ambientPoolReadyRef.current) return;
    const clamped = Math.min(currentIndex, list.length - 1);
    const current = list[clamped];
    if (!current) return;
    if (clamped !== currentIndex) setCurrentIndex(clamped);
    if (loadedIdRef.current === String(current.id)) {
      // 同一首歌（只是签名换了）：不动 src，避免打断播放；签名过期由 error 恢复流程处理
      return;
    }
    if (!loadedIdRef.current) {
      // 首次有曲目：只备源，不自动播（自动播放会被浏览器拦截）
      loadedIdRef.current = String(current.id);
      audio.src = current.url;
      setDuration(current.durationSec);
      return;
    }
    // 当前曲目已从列表消失：切到队列中同位置（或最后一首）
    if (wantPlayRef.current) startTrack(clamped, list);
    else {
      loadedIdRef.current = String(current.id);
      audio.src = current.url;
    }
  }, [queue, currentIndex, startTrack, ambientOn]);

  // ===== 当前曲目回写（歌单弹窗高亮「正在播放」） =====
  useEffect(() => {
    setCurrentId(track ? track.id : null);
  }, [track, setCurrentId]);

  // ===== 外部点歌（歌单弹窗 / 底部 Dock）：指定曲目直接起播 =====
  // 用 at 作为触发信号：同一首歌连点两次也要重新播放；
  // handled 记录已处理的时间戳，避免播放器重新挂载时把上一次点歌又重播一遍
  const handledRequestRef = useRef<number | null>(playRequest?.at ?? null);
  useEffect(() => {
    if (!playRequest) return;
    if (handledRequestRef.current === playRequest.at) return;
    handledRequestRef.current = playRequest.at;
    const wantedId = String(playRequest.id);
    let cancelled = false;
    // 点歌是明确的单曲播放意图：背景音模式下队列里根本没有这首歌，先退出背景音
    if (ambientOnRef.current) setAmbientOn(false);
    wantPlayRef.current = true;
    // 优先用已缓存的曲库（与队列同序），命中就直接播，不必等一次网络往返
    const cached = bypass ? mockAsPlayerTracks() : useMusicStore.getState().tracks.map(toPlayerTrack);
    const cachedIndex = cached.findIndex((item) => String(item.id) === wantedId);
    if (cachedIndex >= 0) {
      startTrackRef.current?.(cachedIndex, cached);
      return;
    }
    // 缓存里没有（曲库未拉过 / 刚新增）：拉一次再播
    fetchLibrary().then((list) => {
      if (cancelled || !list) return;
      const index = list.findIndex((item) => String(item.id) === wantedId);
      if (index >= 0) startTrackRef.current?.(index, list);
      else setNotice('这首曲子已不在曲库中');
    });
    return () => {
      cancelled = true;
    };
    // startTrack / setAmbientOn 走 ref 与稳定 setter，依赖只保留触发信号
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playRequest?.at]);

  // ===== 背景音开关 =====
  // 开启背景音：拉取池子，池就绪后随机起播
  useEffect(() => {
    if (!ambientOn) {
      ambientPoolReadyRef.current = false;
      return;
    }
    let cancelled = false;
    fetchAmbientPool().then((pool) => {
      if (cancelled) return;
      ambientPoolReadyRef.current = true;
      if (pool.length === 0) {
        setNotice('背景音池为空，先去音乐库把曲目加入背景音');
        setAmbientOn(false);
        return;
      }
      setNotice('');
      wantPlayRef.current = true;
      const randomIndex = Math.floor(Math.random() * pool.length);
      startTrackRef.current?.(randomIndex, pool);
    });
    return () => {
      cancelled = true;
    };
    // startTrack / setAmbientOn 用 ref 与稳定 setter，避免重复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientOn, fetchAmbientPool]);

  // 页面可见性：隐藏即暂停，恢复按原状态继续（PRD §4.4）
  useEffect(() => {
    const onVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) {
        if (!audio.paused) {
          pausedByHiddenRef.current = true;
          audio.pause();
        }
      } else if (pausedByHiddenRef.current) {
        pausedByHiddenRef.current = false;
        if (wantPlayRef.current) audio.play().catch(() => pendingGestureRef.current = true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // 自动播放被拦截后，等首次用户手势重试（不弹任何提示）
  useEffect(() => {
    const retry = () => {
      if (!pendingGestureRef.current) return;
      pendingGestureRef.current = false;
      const audio = audioRef.current;
      if (audio && wantPlayRef.current) tryPlay();
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
    return () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
    };
  }, [tryPlay]);

  // ===== 播流签名过期 / 解码失败：静默换新签名后从断点续播 =====
  const recoverFromError = useCallback(async () => {
    const audio = audioRef.current;
    const list = ambientOnRef.current ? poolRef.current : queueRef.current;
    const current = list[Math.min(indexRef.current, Math.max(0, list.length - 1))];
    if (!audio || !current) return;
    const id = String(current.id);
    if (retriedIdRef.current === id) {
      setNotice('音频暂时无法播放，请稍后重试');
      setIsPlaying(false);
      return;
    }
    retriedIdRef.current = id;
    await fetchLibrary();
    let freshList: PlayerTrack[] | null = null;
    if (ambientOnRef.current) freshList = await fetchAmbientPool();
    const source = ambientOnRef.current ? freshList : queueRef.current;
    const fresh = source?.find((item) => String(item.id) === id);
    if (!fresh || !fresh.url) {
      setNotice('音频暂时无法播放，请稍后重试');
      setIsPlaying(false);
      return;
    }
    const resumeAt = lastPosRef.current;
    audio.src = fresh.url;
    const once = () => {
      if (resumeAt > 0) {
        try {
          audio.currentTime = resumeAt;
        } catch {
          /* 个别浏览器此时不可 seek，忽略 */
        }
      }
      if (wantPlayRef.current) tryPlay();
    };
    audio.addEventListener('loadedmetadata', once, { once: true });
    setNotice('');
  }, [fetchLibrary, fetchAmbientPool, tryPlay]);

  useEffect(() => {
    handleErrorRef.current = recoverFromError;
  }, [recoverFromError]);

  // ===== 交互 =====
  const playPrev = () => {
    const list = queue;
    if (!list.length) return;
    startTrack((currentIndex - 1 + list.length) % list.length, list);
  };

  const playNext = () => {
    const list = queue;
    if (!list.length) return;
    startTrack((currentIndex + 1) % list.length, list);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!queue.length) return;
    if (isPlaying) {
      wantPlayRef.current = false;
      pauseAudio(false);
      return;
    }
    wantPlayRef.current = true;
    if (!audio.src || loadedIdRef.current !== String(track?.id)) {
      startTrack(currentIndex, queue);
      return;
    }
    if (ambientOn) {
      audio.volume = 0;
      tryPlay().then((ok) => {
        if (ok) fadeTo(ambientVolume, AMBIENT_FADE_IN_MS);
      });
    } else {
      audio.volume = volume;
      audio.muted = muted;
      tryPlay();
    }
  };

  const toggleAmbient = () => {
    if (!ambientOn) {
      setAmbientOn(true);
      return;
    }
    setAmbientOn(false);
    ambientPoolReadyRef.current = false;
    pauseAudio(true);
  };

  /** 在播放列表里点某首：退出背景音，按普通模式播放 */
  const selectTrack = (index: number) => {
    const list = queue;
    if (ambientOn) {
      setAmbientOn(false);
      ambientOnRef.current = false;
      const normal = bypass ? mockQueue : apiTracks.map(toPlayerTrack);
      // 列表里展示的就是正常曲库，直接用它
      startTrack(index, normal.length ? normal : list);
      return;
    }
    startTrack(index, list);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const target = Math.max(0, Math.min(1, ratio)) * duration;
    audio.currentTime = target;
    setCurrentTime(target);
    lastPosRef.current = target;
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
  const hasTracks = queue.length > 0;
  const cover = track?.cover ?? FALLBACK_COVER;
  const title = track?.title ?? '曲库为空';
  const artist = track
    ? ambientOn
      ? `背景音 · ${track.artist}`
      : track.artist
    : ambientOn
      ? '背景音池为空'
      : '去音乐库上传第一首';
  const initial = track ? track.title.charAt(0) : '♪';
  const effectiveVolume = ambientOn ? ambientVolume : volume;

  return (
    <div
      className={'vc-player' + (dragging ? ' is-dragging' : '')}
      style={{ bottom: `calc(80px + ${offsetY}px)` }}
      onMouseLeave={scheduleAutoHide}
      onMouseEnter={cancelAutoHide}
    >
      {/* 卡片本体 */}
      <div className={'vc-player__card' + (expanded ? '' : ' is-collapsed')} style={{ width: CARD_WIDTH }}>
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
            style={{ background: `linear-gradient(135deg, ${cover[0]}, ${cover[1]})` }}
          >
            {initial}
          </div>
          <div className="vc-player__meta">
            <div className="vc-player__title">
              {title}
              {ambientOn && track && <span className="vc-player__badge">背景音</span>}
              {track?.ai && <span className="vc-player__badge vc-player__badge--ai">AI 生成</span>}
            </div>
            <div className="vc-player__artist">{notice || artist}</div>
          </div>
        </div>

        {/* 控制行 */}
        <div className="vc-player__controls">
          <button
            type="button"
            className="vc-player__skip"
            onClick={playPrev}
            aria-label="上一首"
            disabled={!hasTracks}
          >
            <Icon icon={skipBackIcon} width={22} />
          </button>
          <button
            type="button"
            className="vc-player__play"
            onClick={togglePlay}
            aria-label={isPlaying ? '暂停' : '播放'}
            disabled={!hasTracks}
          >
            <Icon icon={isPlaying ? pauseIcon : playIcon} width={20} style={{ marginLeft: isPlaying ? 0 : 2 }} />
          </button>
          <button
            type="button"
            className="vc-player__skip"
            onClick={playNext}
            aria-label="下一首"
            disabled={!hasTracks}
          >
            <Icon icon={skipForwardIcon} width={22} />
          </button>

          {/* 背景音开关（音量左侧，PRD §4.1） */}
          <button
            type="button"
            className={'vc-player__icon-btn vc-player__ambient' + (ambientOn ? ' is-on' : '')}
            onClick={toggleAmbient}
            aria-label={ambientOn ? '关闭背景音' : '开启背景音'}
            aria-pressed={ambientOn}
            title={ambientOn ? '背景音播放中：低音量循环背景音池' : '开启背景音（低音量循环播放背景音池）'}
          >
            <Icon icon={radioIcon} width={20} />
          </button>

          {/* 音量（背景音模式下控制的是背景音音量） */}
          <div className="vc-player__volume">
            <button
              type="button"
              className="vc-player__mute"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? '取消静音' : '静音'}
            >
              <Icon icon={muted || effectiveVolume === 0 ? volumeXIcon : volume2Icon} width={20} />
            </button>
            <input
              className="vc-player__range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : effectiveVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (ambientOn) setAmbientVolume(v);
                else setVolume(v);
                if (v > 0) setMuted(false);
                // 直接落到 audio 上，避免等 effect（手动调音量应即时生效）
                const audio = audioRef.current;
                if (audio && !fadingRef.current) {
                  audio.volume = v;
                  audio.muted = false;
                }
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
            <span>{formatTime(duration || (track?.durationSec ?? 0))}</span>
          </div>
        </div>

        {/* 播放列表（根据位置向上或向下弹出） */}
        {playlistOpen && (
          <div
            className={'vc-player__list' + (listUpward ? ' is-up' : '')}
            style={listUpward ? { bottom: '100%' } : { top: '100%' }}
          >
            <div className="vc-player__list-head">
              {ambientOn ? '背景音池' : '播放列表'} · {queue.length} 首
            </div>
            {queue.length === 0 && (
              <div className="vc-player__list-empty">
                {ambientOn ? '背景音池为空，去音乐库把曲目加入背景音' : '曲库为空，先去音乐库上传'}
              </div>
            )}
            {queue.map((t, i) => {
              const active = i === currentIndex;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => selectTrack(i)}
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
                  <div className="vc-player__track-dur">{formatTime(t.durationSec)}</div>
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
