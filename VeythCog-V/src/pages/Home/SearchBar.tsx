import React from 'react';
import { Icon } from '@iconify/react';
import searchIcon from '@iconify-icons/lucide/search';
import chevronIcon from '@iconify-icons/lucide/chevron-down';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import historyIcon from '@iconify-icons/lucide/history';
import bookmarkIcon from '@iconify-icons/lucide/bookmark';
import languagesIcon from '@iconify-icons/lucide/languages';
import copyIcon from '@iconify-icons/lucide/copy';
import externalLinkIcon from '@iconify-icons/lucide/external-link';
import loaderIcon from '@iconify-icons/lucide/loader-circle';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import rotateIcon from '@iconify-icons/lucide/rotate-cw';
import xIcon from '@iconify-icons/lucide/x';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getAllBookmarks } from '@/api/nav';
import type { NavBookmark } from '@/api/nav';
import {
  clearSearchHistory,
  getSearchStatus,
  getSearchSuggest,
  readSearchHistory,
  readKnowledgeFirst,
  recordSearchHistory,
  streamSearchAi,
  translateSearch,
  writeKnowledgeFirst,
} from '@/api/search';
import type {
  SearchAiMeta,
  SearchHistoryItem,
  SearchStatus,
  SearchSuggestion,
  SearchTranslation,
} from '@/api/search';
import { useNavStore } from '@/stores/navStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';
import { glassBlur, whiteGlass } from '@/styles/homeSurface';
import type { RetrieveChunk } from '@/types';

interface AiState {
  status: 'idle' | 'loading' | 'streaming' | 'done' | 'error';
  answer: string;
  meta: SearchAiMeta | null;
  references: RetrieveChunk[];
  error?: string;
  knowledgeFirst: boolean;
}

const EMPTY_AI: AiState = {
  status: 'idle',
  answer: '',
  meta: null,
  references: [],
  knowledgeFirst: false,
};

type EngineKey = 'baidu' | 'google' | 'bing';

/** 搜索引擎品牌图标路径（Simple Icons，固定配置，不依赖运行时图标请求） */
const ENGINE_ICON_PATHS: Record<EngineKey, string> = {
  baidu:
    'M9.154 0C7.71 0 6.54 1.658 6.54 3.707c0 2.051 1.171 3.71 2.615 3.71 1.446 0 2.614-1.659 2.614-3.71C11.768 1.658 10.6 0 9.154 0zm7.025.594C14.86.58 13.347 2.589 13.2 3.927c-.187 1.745.25 3.487 2.179 3.735 1.933.25 3.175-1.806 3.422-3.364.252-1.555-.995-3.364-2.362-3.674a1.218 1.218 0 0 0-.261-.03zM3.582 5.535a2.811 2.811 0 0 0-.156.008c-2.118.19-2.428 3.24-2.428 3.24-.287 1.41.686 4.425 3.297 3.864 2.617-.561 2.262-3.68 2.183-4.362-.125-1.018-1.292-2.773-2.896-2.75zm16.534 1.753c-2.308 0-2.617 2.119-2.617 3.616 0 1.43.121 3.425 2.988 3.362 2.867-.063 2.553-3.238 2.553-3.988 0-.745-.62-2.99-2.924-2.99zm-8.264 2.478c-1.424.014-2.708.925-3.323 1.947-1.118 1.868-2.863 3.05-3.112 3.363-.25.309-3.61 2.116-2.864 5.42.746 3.301 3.365 3.237 3.365 3.237s1.93.19 4.171-.31c2.24-.495 4.17.123 4.17.123s5.233 1.748 6.665-1.616c1.43-3.364-.808-5.109-.808-5.109s-2.99-2.306-4.736-4.798c-1.072-1.665-2.348-2.268-3.528-2.257zm-2.234 3.84l1.542.024v8.197H7.758c-1.47-.291-2.055-1.292-2.13-1.462-.072-.173-.488-.976-.268-2.343.635-2.049 2.447-2.196 2.447-2.196h1.81zm3.964 2.39v3.881c.096.413.612.488.612.488h1.614v-4.343h1.689v5.782h-3.915c-1.517-.39-1.59-1.465-1.59-1.465v-4.317zm-5.458 1.147c-.66.197-.978.708-1.05.928-.076.22-.247.78-.1 1.269.294 1.095 1.248 1.144 1.248 1.144h1.37v-3.34z',
  google:
    'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  bing:
    'M20.176 15.406a6.48 6.48 0 0 1-1.736 4.414c1.338-1.47.803-3.869-1.003-4.635-.862-.305-2.488-.85-3.367-1.158a1.834 1.834 0 0 1-.932-.818c-.381-.975-1.163-2.968-1.548-3.948-.095-.285-.31-.625-.265-.938.046-.598.724-1.003 1.276-.754l3.682 1.888c.621.292 1.305.692 1.796 1.172a6.486 6.486 0 0 1 2.097 4.777zm-1.44 1.888c-.264-1.194-1.135-1.744-2.216-2.028-1.527.902-4.853 2.878-6.952 4.13-1.103.68-2.13 1.35-2.919 1.242a2.866 2.866 0 0 1-2.77-2.325c-.012-.048-.008-.03-.001.01a6.4 6.4 0 0 0 .947 2.653 6.498 6.498 0 0 0 5.486 3.022c1.908.062 3.536-1.153 5.099-2.096.292-.188.804-.496 1.332-.831l1.423-1.51c.553-.577.764-1.426.571-2.267zm-12.04 2.97c.422 0 .822-.1 1.173-.29.355-.215.964-.579 1.7-1.018L9.57 4.502c0-.99-.497-1.864-1.257-2.382-.08-.059-2.91-1.901-2.99-1.956-.605-.432-1.523.045-1.5.797v14.887l.417 2.36a2.488 2.488 0 0 0 2.455 2.056z',
};

const EngineLogo: React.FC<{ engine: EngineKey; size?: number; color: string }> = ({
  engine,
  size = 18,
  color,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d={ENGINE_ICON_PATHS[engine]} />
  </svg>
);

/** 是否为可直接打开的 URL：命中时跳过翻译 / 远端联想，回车按网址处理 */
function isLikelyUrl(value: string): boolean {
  const text = value.trim();
  if (!text || /\s/.test(text)) return false;
  return /^(https?:\/\/|www\.|[a-z0-9-]+(\.[a-z0-9-]+)+)([/:?#].*)?$/i.test(text);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function bookmarkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 本地联想：书签（标题/域名命中）优先，其次最近搜索 */
function buildLocalSuggestions(
  query: string,
  bookmarks: NavBookmark[],
  history: SearchHistoryItem[],
): SearchSuggestion[] {
  const q = normalize(query);
  if (!q) return [];

  const bookmarkHits = bookmarks
    .map((bookmark) => {
      const host = bookmarkHost(bookmark.url);
      const hay = `${bookmark.title} ${host}`.toLowerCase();
      if (!hay.includes(q)) return null;
      const score = bookmark.title.toLowerCase().startsWith(q)
        ? 0
        : host.toLowerCase().startsWith(q)
          ? 1
          : 2;
      return { bookmark, score };
    })
    .filter((item): item is { bookmark: NavBookmark; score: number } => !!item)
    .sort((a, b) => a.score - b.score || a.bookmark.title.localeCompare(b.bookmark.title))
    .slice(0, 5)
    .map(({ bookmark }) => ({
      type: 'bookmark' as const,
      text: bookmark.title,
      bookmarkId: bookmark.id,
      url: bookmark.url,
    }));

  const historyHits = history
    .filter((item) => item.text.toLowerCase().includes(q))
    .slice(0, 4)
    .map((item) => ({ type: 'history' as const, text: item.text }));

  const seen = new Set<string>();
  const result: SearchSuggestion[] = [];
  for (const item of [...bookmarkHits, ...historyHits]) {
    const key = normalize(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= 7) break;
  }
  return result;
}

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const searchEngine = useNavStore((s) => s.searchEngine);
  const setSearchEngine = useNavStore((s) => s.setSearchEngine);
  const wallpaper = useWallpaperStore((s) => s.active);
  const { colors } = useTheme();
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);

  const [q, setQ] = React.useState('');
  const [engineOpen, setEngineOpen] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [bookmarks, setBookmarks] = React.useState<NavBookmark[]>([]);
  const [history, setHistory] = React.useState<SearchHistoryItem[]>(readSearchHistory);
  const [remoteSuggestions, setRemoteSuggestions] = React.useState<string[]>([]);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [translation, setTranslation] = React.useState<SearchTranslation | null>(null);
  const [translationLoading, setTranslationLoading] = React.useState(false);
  const [status, setStatus] = React.useState<SearchStatus | null>(null);
  const [knowledgeFirst, setKnowledgeFirst] = React.useState<boolean>(readKnowledgeFirst);
  const [ai, setAi] = React.useState<AiState>(EMPTY_AI);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const aiAbortRef = React.useRef<AbortController | null>(null);
  const requestSeq = React.useRef(0);
  const translationSeq = React.useRef(0);
  const bookmarksRequestedRef = React.useRef(false);
  const searchStatusRequestedRef = React.useRef(false);
  const aliveRef = React.useRef(true);

  /** 空闲渐隐：鼠标未悬停、输入框未聚焦、面板关闭且 AI 空闲时，3 分钟后淡化为淡轮廓 */
  const FADE_TIMEOUT_MS = 3 * 60 * 1000;
  const [dimmed, setDimmed] = React.useState(false);
  const hoverRef = React.useRef(false);
  const focusRef = React.useRef(false);
  const fadeTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /**
   * 全量书签只在用户真正搜索时加载：首屏不再拉 /nav/bookmarks/all（约 103KB）。
   * 失败后允许下次重新请求。
   */
  const ensureAllBookmarks = React.useCallback(() => {
    if (bookmarksRequestedRef.current) return;
    bookmarksRequestedRef.current = true;
    getAllBookmarks()
      .then((list) => {
        if (aliveRef.current) setBookmarks(list ?? []);
      })
      .catch(() => {
        bookmarksRequestedRef.current = false;
        if (aliveRef.current) setBookmarks([]);
      });
  }, []);

  /**
   * 知识库可用性 / 默认模型状态也只在用户聚焦搜索框时拉取：
   * 首屏不打开搜索面板就不需要它，避免和 /nav/bootstrap 抢带宽。
   */
  const ensureSearchStatus = React.useCallback(() => {
    if (searchStatusRequestedRef.current) return;
    searchStatusRequestedRef.current = true;
    getSearchStatus()
      .then((value) => {
        if (aliveRef.current) setStatus(value);
      })
      .catch(() => {
        searchStatusRequestedRef.current = false;
        if (aliveRef.current) setStatus(null);
      });
  }, []);

  const isWallpaperMode = !!wallpaper?.url;
  // 无壁纸：完全用主题玻璃（.vc-search__bar）；有壁纸：白色玻璃，厚度与全局「朦胧度」联动
  const barStyle: React.CSSProperties = isWallpaperMode
    ? {
        background: `linear-gradient(180deg, ${whiteGlass(glassOpacity, 0.3, 0.55)} 0%, ${whiteGlass(glassOpacity, 0.16, 0.3)} 100%)`,
        borderColor: 'rgba(255,255,255,0.55)',
        backdropFilter: glassBlur(glassOpacity),
        WebkitBackdropFilter: glassBlur(glassOpacity),
        boxShadow: '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.65)',
      }
    : {};
  const accent = colors.primary;

  const engines: { key: EngineKey; label: string }[] = [
    { key: 'baidu', label: 'Baidu' },
    { key: 'google', label: 'Google' },
    { key: 'bing', label: 'Bing' },
  ];
  const currentEngine = engines.find((e) => e.key === searchEngine) ?? engines[0];

  const knowledgeAvailable = !!status?.knowledgeAvailable;
  const effectiveKnowledgeFirst = knowledgeFirst && knowledgeAvailable;
  const localSuggestions = React.useMemo(
    () => buildLocalSuggestions(q, bookmarks, history),
    [q, bookmarks, history],
  );
  const visibleSuggestions = React.useMemo(() => {
    const seen = new Set(localSuggestions.map((item) => normalize(item.text)));
    const remote = remoteSuggestions
      .map((text) => ({ type: 'remote' as const, text }))
      .filter((item) => {
        const key = normalize(item.text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
    return [...localSuggestions, ...remote];
  }, [localSuggestions, remoteSuggestions]);

  // 引用按文档聚合：同一篇文档的多个分片合并为一条来源，避免标题重复堆叠
  const sourceGroups = React.useMemo(() => {
    const map = new Map<number, { docId: number; title: string; chunks: number[]; preview: string }>();
    for (const ref of ai.references) {
      const group = map.get(ref.docId);
      if (group) {
        group.chunks.push(ref.chunkIndex);
      } else {
        map.set(ref.docId, {
          docId: ref.docId,
          title: ref.title,
          chunks: [ref.chunkIndex],
          preview: ref.chunkText,
        });
      }
    }
    return [...map.values()];
  }, [ai.references]);

  // 远端联想：300ms 防抖，仅对非 URL、长度 ≥2 的输入请求
  React.useEffect(() => {
    const query = q.trim();
    if (!panelOpen || isLikelyUrl(query) || query.length < 2) {
      setRemoteSuggestions([]);
      setRemoteLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setRemoteLoading(true);
    const timer = window.setTimeout(() => {
      getSearchSuggest(query, searchEngine)
        .then((items) => {
          if (seq !== requestSeq.current) return;
          setRemoteSuggestions((items ?? []).slice(0, 5));
        })
        .catch(() => {
          if (seq === requestSeq.current) setRemoteSuggestions([]);
        })
        .finally(() => {
          if (seq === requestSeq.current) setRemoteLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, searchEngine, panelOpen]);

  // 首行翻译：600ms 防抖；URL 不翻译，AI 面板打开时不打扰
  React.useEffect(() => {
    const query = q.trim();
    if (
      !panelOpen ||
      ai.status !== 'idle' ||
      query.length < 2 ||
      isLikelyUrl(query)
    ) {
      setTranslation(null);
      setTranslationLoading(false);
      return;
    }
    const seq = ++translationSeq.current;
    setTranslationLoading(true);
    const timer = window.setTimeout(() => {
      translateSearch(query)
        .then((result) => {
          if (seq !== translationSeq.current) return;
          setTranslation(result);
        })
        .catch(() => {
          if (seq === translationSeq.current) setTranslation(null);
        })
        .finally(() => {
          if (seq === translationSeq.current) setTranslationLoading(false);
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [q, panelOpen, ai.status]);

  // 点击外部关闭联想面板；AI 回答展开时保留，避免误丢内容
  React.useEffect(() => {
    if (!panelOpen && !engineOpen) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setEngineOpen(false);
        if (ai.status === 'idle') setPanelOpen(false);
      }
    };
    const timer = window.setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousedown', close);
    };
  }, [panelOpen, engineOpen, ai.status]);

  // ---- 空闲渐隐调度：悬停 / 聚焦 / 面板展开 / AI 作答期间保持清晰，其余 3 分钟后淡化 ----
  const clearFadeTimer = React.useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const scheduleFade = React.useCallback(() => {
    clearFadeTimer();
    const active =
      hoverRef.current || focusRef.current || panelOpen || engineOpen || ai.status !== 'idle';
    if (active) {
      setDimmed(false);
      return;
    }
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null;
      setDimmed(true);
    }, FADE_TIMEOUT_MS);
  }, [clearFadeTimer, panelOpen, engineOpen, ai.status]);

  const wake = React.useCallback(() => {
    clearFadeTimer();
    setDimmed(false);
    scheduleFade();
  }, [clearFadeTimer, scheduleFade]);

  // 面板 / AI 状态变化时重新判定是否进入空闲
  React.useEffect(() => {
    scheduleFade();
    return clearFadeTimer;
  }, [scheduleFade, clearFadeTimer]);

  // 卸载清理计时
  React.useEffect(() => clearFadeTimer, [clearFadeTimer]);

  // 输入变化时终止旧 AI 流，避免旧结果落到新问题
  const stopAi = React.useCallback(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAi(EMPTY_AI);
  }, []);

  const handleChange = (value: string) => {
    ensureAllBookmarks();
    ensureSearchStatus();
    setQ(value);
    setPanelOpen(!!value.trim());
    setActiveIndex(-1);
    if (ai.status !== 'idle') stopAi();
  };

  const doSearch = (override?: string) => {
    const query = (override ?? q).trim();
    if (!query) return;
    const map: Record<string, string> = {
      baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
      google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    };
    recordSearchHistory(query);
    setHistory(readSearchHistory());
    setPanelOpen(false);
    window.open(map[searchEngine], '_blank', 'noopener,noreferrer');
  };

  const openBookmark = (bookmark: SearchSuggestion) => {
    if (!bookmark.url) return;
    setPanelOpen(false);
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  };

  const startAi = () => {
    const query = q.trim();
    if (!query) return;
    if (status && !status.modelName) {
      message.warning('请先在设置中绑定一个可用模型');
      return;
    }
    aiAbortRef.current?.abort();
    setPanelOpen(true);
    setActiveIndex(-1);
    setAi({
      status: 'loading',
      answer: '',
      meta: null,
      references: [],
      knowledgeFirst: effectiveKnowledgeFirst,
    });
    aiAbortRef.current = streamSearchAi({
      query,
      knowledgeFirst: effectiveKnowledgeFirst,
      onMeta: (meta) => setAi((prev) => ({ ...prev, meta })),
      onReferences: (references) => setAi((prev) => ({ ...prev, references })),
      onDelta: (text) =>
        setAi((prev) => ({
          ...prev,
          status: 'streaming',
          answer: prev.answer + text,
        })),
      onDone: () => setAi((prev) => ({ ...prev, status: 'done' })),
      onError: (error) =>
        setAi((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || '搜索回答失败',
        })),
    });
  };

  const closePanel = () => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAi(EMPTY_AI);
    setPanelOpen(false);
    inputRef.current?.blur();
  };

  const chooseSuggestion = (item: SearchSuggestion) => {
    if (item.type === 'bookmark' && item.url) {
      openBookmark(item);
      return;
    }
    setQ(item.text);
    doSearch(item.text);
  };

  const toggleKnowledgeFirst = () => {
    if (!knowledgeAvailable) {
      message.info('知识库还没有已向量化文档，暂不可开启');
      return;
    }
    const next = !knowledgeFirst;
    setKnowledgeFirst(next);
    writeKnowledgeFirst(next);
  };

  const copyText = (text: string, successMessage: string) => {
    if (!text.trim()) return;
    navigator.clipboard
      .writeText(text)
      .then(() => message.success(successMessage))
      .catch(() => message.error('复制失败，请手动选择文本'));
  };

  const copyAnswer = () => copyText(ai.answer, '已复制 AI 回答');

  const copyTranslation = () => copyText(translation?.translatedText ?? '', '已复制译文');

  const continueChat = () => {
    const query = q.trim();
    if (!query) return;
    aiAbortRef.current?.abort();
    navigate(`/chat?prefill=${encodeURIComponent(query)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ai.status !== 'idle') stopAi();
      setPanelOpen(false);
      setEngineOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        startAi();
        return;
      }
      if (panelOpen && activeIndex >= 0 && visibleSuggestions[activeIndex]) {
        e.preventDefault();
        chooseSuggestion(visibleSuggestions[activeIndex]);
        return;
      }
      e.preventDefault();
      doSearch();
      return;
    }
    if (!panelOpen || ai.status !== 'idle') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!visibleSuggestions.length) return;
      setActiveIndex((index) => (index + 1) % visibleSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!visibleSuggestions.length) return;
      setActiveIndex((index) => (index <= 0 ? visibleSuggestions.length - 1 : index - 1));
    }
  };


  const aiVisible = ai.status !== 'idle';
  const translationVisible =
    !!translation &&
    translation.translatedText.trim() !== '' &&
    translation.translatedText.trim() !== q.trim();

  return (
    <div
      ref={rootRef}
      className={"vc-search" + (dimmed ? " is-dimmed" : "")}
      onMouseEnter={() => {
        hoverRef.current = true;
        wake();
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        scheduleFade();
      }}
    >
      <div className="vc-search__bar" style={barStyle}>
        {/* 搜索引擎：主题化下拉，替换原生 select */}
        <div className="vc-search__engine">
          <button
            type="button"
            className="vc-search__engine-btn"
            onClick={() => {
              setEngineOpen((o) => !o);
              setPanelOpen(false);
            }}
            title={currentEngine.label}
            aria-label={"Search engine: " + currentEngine.label}
            aria-expanded={engineOpen}
          >
            <EngineLogo engine={currentEngine.key} size={18} color={isWallpaperMode ? '#fff' : colors.text} />
            <span className={"vc-search__chevron" + (engineOpen ? " is-open" : "")}>
              <Icon icon={chevronIcon} width={14} />
            </span>
          </button>

          {engineOpen && (
            <div className="vc-search__menu" role="listbox">
              {engines.map((e) => {
                const active = e.key === searchEngine;
                return (
                  <div
                    key={e.key}
                    role="option"
                    aria-selected={active}
                    tabIndex={0}
                    className={"vc-search__menu-item" + (active ? " is-active" : "")}
                    onClick={() => {
                      setSearchEngine(e.key);
                      setEngineOpen(false);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSearchEngine(e.key);
                        setEngineOpen(false);
                      }
                    }}
                  >
                    <span className="vc-search__menu-label">
                      <EngineLogo engine={e.key} size={16} color={active ? accent : 'currentColor'} />
                      {e.label}
                    </span>
                    {active && (
                      <span className="vc-search__menu-check">
                        <Icon icon={chevronIcon} width={12} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          className="vc-search__input"
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            focusRef.current = true;
            wake();
            ensureAllBookmarks();
            ensureSearchStatus();
            if (q.trim()) setPanelOpen(true);
          }}
          onBlur={() => {
            focusRef.current = false;
            scheduleFade();
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入搜索内容，Ctrl/Cmd+Enter 让 AI 回答"
          aria-label="搜索"
          aria-expanded={panelOpen}
          aria-controls="search-suggest-panel"
        />

        {/* AI 回答：显式按钮，Enter 仍然只做网页搜索 */}
        <button
          type="button"
          className="vc-search__icon-btn"
          onClick={startAi}
          title="AI 回答（Ctrl/Cmd+Enter）"
          aria-label="AI 回答"
        >
          <Icon icon={sparklesIcon} width={17} />
        </button>

        {/* 放大镜：纯色字符图标，无按钮底色，颜色与框内文字一致 */}
        <button type="button" className="vc-search__icon-btn" onClick={() => doSearch()} title="搜索" aria-label="搜索">
          <Icon icon={searchIcon} width={20} />
        </button>
      </div>

      {panelOpen && (
        <div id="search-suggest-panel" className="vc-search__panel">
          {aiVisible ? (
            <>
              <div className="vc-search__panel-head">
                <Icon icon={sparklesIcon} width={17} color={accent} />
                <div className="vc-search__panel-main">
                  <div className="vc-search__panel-title">
                    AI 回答
                    {ai.meta?.modelName ? <span className="vc-search__panel-model">{ai.meta.modelName}</span> : null}
                  </div>
                  <div className="vc-search__panel-sub">
                    {ai.status === 'loading'
                      ? effectiveKnowledgeFirst
                        ? '正在检索全库知识库并生成回答…'
                        : '正在生成回答…'
                      : ai.meta?.knowledgeFirst
                        ? ai.meta?.knowledgeHit
                          ? '已检索全库知识库并命中资料'
                          : '知识库未命中，按通用知识回答'
                        : '未开启知识库，按通用知识回答'}
                  </div>
                </div>
                <button
                  type="button"
                  className={"vc-search__kb" + (effectiveKnowledgeFirst ? " is-on" : "")}
                  onClick={toggleKnowledgeFirst}
                  disabled={!knowledgeAvailable}
                  aria-pressed={effectiveKnowledgeFirst}
                  title={knowledgeAvailable ? '优先查询当前账号全部已向量化文档' : '知识库暂无已向量化文档'}
                >
                  <Icon icon={bookOpenIcon} width={13} />
                  知识库
                  <span className="vc-search__kb-track">
                    <span className="vc-search__kb-thumb" />
                  </span>
                </button>
                <button
                  type="button"
                  className="vc-search__ghost"
                  onClick={closePanel}
                  title="关闭 AI 回答"
                  aria-label="关闭 AI 回答"
                >
                  <Icon icon={xIcon} width={16} />
                </button>
              </div>

              {(ai.status === 'loading' || ai.status === 'streaming') && !ai.answer && (
                <div className="vc-search__nudge">
                  <Icon icon={loaderIcon} width={16} className="vc-spin" />
                  正在生成…
                </div>
              )}

              {ai.answer && (
                <div className="vc-search__answer md-body">
                  {ai.answer}
                  {ai.status === 'streaming' && <span className="vc-search__caret">▍</span>}
                </div>
              )}

              {ai.status === 'error' && <div className="vc-search__error">{ai.error || '搜索回答失败'}</div>}

              {sourceGroups.length > 0 && (
                <div className="vc-search__sources">
                  <div className="vc-search__sources-head">
                    <Icon icon={bookOpenIcon} width={12} />
                    参考来源 · 知识库文档（{sourceGroups.length} 篇）
                  </div>
                  {sourceGroups.map((group) => (
                    <div key={group.docId} className="vc-search__source" title={group.preview}>
                      <span className="vc-search__source-title">《{group.title || '未命名文档'}》</span>
                      <span className="vc-search__source-meta">
                        分片 {group.chunks.map((c) => "#" + c).join('、')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="vc-search__foot">
                <button type="button" className="vc-search__ghost" onClick={copyAnswer} disabled={!ai.answer}>
                  <Icon icon={copyIcon} width={13} />
                  复制
                </button>
                {(ai.status === 'done' || ai.status === 'error') && (
                  <>
                    <button type="button" className="vc-search__ghost" onClick={startAi}>
                      <Icon icon={rotateIcon} width={13} />
                      重新回答
                    </button>
                    <button
                      type="button"
                      className="vc-search__ghost vc-search__ghost--primary vc-search__ghost--end"
                      onClick={continueChat}
                    >
                      继续追问
                      <Icon icon={externalLinkIcon} width={13} />
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {translationLoading && (
                <div className="vc-search__nudge">
                  <Icon icon={loaderIcon} width={14} className="vc-spin" />
                  正在翻译…
                </div>
              )}
              {translationVisible && translation && (
                <div
                  className="vc-search__translate"
                  onClick={copyTranslation}
                  title="点击复制译文"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') {
                      ev.preventDefault();
                      copyTranslation();
                    }
                  }}
                >
                  <Icon icon={languagesIcon} width={16} color={accent} className="vc-search__translate-icon" />
                  <div className="vc-search__translate-body">
                    <div className="vc-search__translate-label">
                      {translation.targetLang === 'en' ? '译成英文' : '译成中文'}
                    </div>
                    <div className="vc-search__translate-text">{translation.translatedText}</div>
                  </div>
                  <Icon icon={copyIcon} width={13} className="vc-search__translate-copy" />
                </div>
              )}

              {visibleSuggestions.length > 0 ? (
                <div>
                  {visibleSuggestions.map((item, index) => {
                    const active = index === activeIndex;
                    const isBookmark = item.type === 'bookmark';
                    const icon = isBookmark ? bookmarkIcon : item.type === 'history' ? historyIcon : searchIcon;
                    return (
                      <div
                        key={item.type + "-" + item.text + "-" + index}
                        role="button"
                        tabIndex={0}
                        className={"vc-suggest" + (active ? " is-active" : "")}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => chooseSuggestion(item)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault();
                            chooseSuggestion(item);
                          }
                        }}
                      >
                        <Icon icon={icon} width={15} color={isBookmark ? accent : undefined} className="vc-suggest__icon" />
                        <div className="vc-suggest__main">
                          <div className="vc-suggest__label">{item.text}</div>
                          {isBookmark && item.url && <div className="vc-suggest__meta">{bookmarkHost(item.url)}</div>}
                        </div>
                        {isBookmark ? (
                          <Icon icon={externalLinkIcon} width={13} className="vc-suggest__tail" />
                        ) : (
                          <span className="vc-suggest__tail">{item.type === 'history' ? '最近搜索' : '搜索'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !translationLoading && <div className="vc-search__nudge">按 Enter 搜索「{q.trim()}」</div>
              )}

              <div className="vc-search__hint">
                <span>Enter 搜索</span>
                <span>Ctrl/Cmd+Enter AI 回答</span>
                {remoteLoading && (
                  <span className="vc-search__hint-tail">
                    <Icon icon={loaderIcon} width={12} className="vc-spin" />
                    联想中
                  </span>
                )}
                {!remoteLoading && history.length > 0 && (
                  <button
                    type="button"
                    className="vc-search__ghost vc-search__ghost--end"
                    onClick={() => {
                      clearSearchHistory();
                      setHistory([]);
                    }}
                  >
                    清空最近搜索
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
