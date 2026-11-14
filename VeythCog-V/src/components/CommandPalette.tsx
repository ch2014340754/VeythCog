import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { Icon } from '@iconify/react';
import { useLocation, useNavigate } from 'react-router-dom';
import activityIcon from '@iconify-icons/lucide/activity';
import birdIcon from '@iconify-icons/lucide/bird';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import bookmarkIcon from '@iconify-icons/lucide/bookmark';
import brainIcon from '@iconify-icons/lucide/brain';
import clockIcon from '@iconify-icons/lucide/clock';
import cpuIcon from '@iconify-icons/lucide/cpu';
import homeIcon from '@iconify-icons/lucide/house';
import listIcon from '@iconify-icons/lucide/list-checks';
import logOutIcon from '@iconify-icons/lucide/log-out';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import moonIcon from '@iconify-icons/lucide/moon';
import paletteIcon from '@iconify-icons/lucide/palette';
import searchIcon from '@iconify-icons/lucide/search';
import settingsIcon from '@iconify-icons/lucide/settings';
import settings2Icon from '@iconify-icons/lucide/settings-2';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import sunIcon from '@iconify-icons/lucide/sun';
import userIcon from '@iconify-icons/lucide/user';
import usersIcon from '@iconify-icons/lucide/users';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import { getAllBookmarks, type NavBookmark } from '@/api/nav';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import type { ToolEntry } from '@/pages/tools/registry';

/** 面板只用到工具元数据；registry 走动态 import，避免把 20+ 工具图标打进首屏 */
type PaletteTool = Pick<ToolEntry, 'id' | 'name' | 'description' | 'category' | 'icon'>;

type PaletteGroup = '页面' | '工具' | '书签' | '操作';

interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
}

const GROUP_ORDER: PaletteGroup[] = ['页面', '工具', '书签', '操作'];

const SETTINGS_PAGES: { path: string; label: string; icon: typeof userIcon }[] = [
  { path: '/settings/account', label: '账号设置', icon: userIcon },
  { path: '/settings/providers', label: '模型配置', icon: cpuIcon },
  { path: '/settings/lark', label: '飞书绑定', icon: birdIcon },
  { path: '/settings/appearance', label: '外观', icon: paletteIcon },
];

const ADMIN_PAGES: { path: string; label: string; icon: typeof userIcon }[] = [
  { path: '/admin/users', label: '用户管理', icon: usersIcon },
  { path: '/admin/roles', label: '角色管理', icon: shieldIcon },
  { path: '/admin/models', label: '模型目录', icon: brainIcon },
  { path: '/admin/monitor', label: '系统监控', icon: activityIcon },
  { path: '/admin/audit', label: '审计日志', icon: listIcon },
  { path: '/admin/tasks', label: '定时任务', icon: clockIcon },
  { path: '/admin/config', label: '系统配置', icon: settings2Icon },
];

/** 可编辑元素内不抢 `/` 等裸键 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * 全局命令面板：Ctrl/Cmd+K。
 * - 页面 / 工具 / 书签 / 操作统一检索；
 * - 书签走 `getAllBookmarks()` 的 5 分钟缓存，失败静默隐藏分组；
 * - `/` 在 /home 聚焦首页搜索框（派发 `veythcog:focus-search`）。
 */
const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isDark, setAppearance } = useTheme();
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookmarks, setBookmarks] = useState<NavBookmark[]>([]);
  const [paletteTools, setPaletteTools] = useState<PaletteTool[]>([]);
  const [toolsLoaded, setToolsLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bookmarksRequestedRef = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  /** 工具目录首次打开面板时按需加载（registry chunk，不进首屏） */
  useEffect(() => {
    if (!open || toolsLoaded) return;
    let alive = true;
    import('@/pages/tools/registry')
      .then((mod) => {
        if (!alive) return;
        setPaletteTools(
          mod.tools.map(({ id, name, description, category, icon }) => ({
            id,
            name,
            description,
            category,
            icon,
          })),
        );
        setToolsLoaded(true);
      })
      .catch(() => {
        // 加载失败只影响「工具」分组，下次打开重试
      });
    return () => {
      alive = false;
    };
  }, [open, toolsLoaded]);

  /** 打开时静默拉一次全量书签（接口内部有 5 分钟缓存） */
  useEffect(() => {
    if (!open || bookmarksRequestedRef.current) return;
    bookmarksRequestedRef.current = true;
    let alive = true;
    getAllBookmarks()
      .then((list) => {
        if (alive) setBookmarks(list ?? []);
      })
      .catch(() => {
        bookmarksRequestedRef.current = false;
      });
    return () => {
      alive = false;
    };
  }, [open]);

  /** 打开后把焦点交给输入框（Modal 内容挂载与动画完成时机不固定，用定时器兜底） */
  useEffect(() => {
    if (!open || pathname === '/login') return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, pathname]);

  /** 路由变化后收起面板（导航本身由面板触发，这里兜底遮罩外跳转） */
  useEffect(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, [pathname]);

  /** 全局快捷键：Ctrl/Cmd+K 开关；/home 下 `/` 聚焦搜索框 */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pathname === '/login') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        setQuery('');
        setActiveIndex(0);
        return;
      }
      if (open) return;
      if (e.key === '/' && pathname === '/home' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        window.dispatchEvent(new Event('veythcog:focus-search'));
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('veythcog:open-palette', openHandler);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('veythcog:open-palette', openHandler);
    };
  }, [open, pathname]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (path: string) => () => navigate(path);

    const pageItems: PaletteItem[] = [
      {
        id: 'page-home',
        group: '页面',
        label: '导航首页',
        hint: '/home',
        keywords: 'home 首页 新标签页',
        icon: <Icon icon={homeIcon} width={16} />,
        run: go('/home'),
      },
      {
        id: 'page-chat',
        group: '页面',
        label: '对话',
        hint: '/chat',
        keywords: 'chat 聊天 ai',
        icon: <Icon icon={messageSquareIcon} width={16} />,
        run: go('/chat'),
      },
      {
        id: 'page-knowledge',
        group: '页面',
        label: '知识库',
        hint: '/knowledge',
        keywords: 'knowledge rag 文档',
        icon: <Icon icon={bookOpenIcon} width={16} />,
        run: go('/knowledge'),
      },
      {
        id: 'page-tools',
        group: '页面',
        label: '工具集',
        hint: '/tools',
        keywords: 'tools 开发工具',
        icon: <Icon icon={wrenchIcon} width={16} />,
        run: go('/tools'),
      },
      ...SETTINGS_PAGES.map<PaletteItem>((p) => ({
        id: `page${p.path}`,
        group: '页面',
        label: p.label,
        hint: p.path,
        keywords: `settings 设置 ${p.label}`,
        icon: <Icon icon={p.icon} width={16} />,
        run: go(p.path),
      })),
    ];

    if (isAdmin) {
      pageItems.push(
        ...ADMIN_PAGES.map<PaletteItem>((p) => ({
          id: `page${p.path}`,
          group: '页面',
          label: p.label,
          hint: p.path,
          keywords: `admin 管理 ${p.label}`,
          icon: <Icon icon={p.icon} width={16} />,
          run: go(p.path),
        })),
      );
    }

    const toolItems: PaletteItem[] = paletteTools.map((tool) => ({
      id: `tool-${tool.id}`,
      group: '工具',
      label: tool.name,
      hint: tool.category,
      keywords: `${tool.description} ${tool.category} ${tool.id}`,
      icon: tool.icon,
      run: go(`/tools/${tool.id}`),
    }));

    const bookmarkItems: PaletteItem[] = bookmarks.map((b) => ({
      id: `bookmark-${b.id}`,
      group: '书签',
      label: b.title,
      hint: hostOf(b.url),
      keywords: b.url,
      icon: <Icon icon={bookmarkIcon} width={16} />,
      run: () => window.open(b.url, '_blank', 'noopener,noreferrer'),
    }));

    const actionItems: PaletteItem[] = [
      {
        id: 'action-theme',
        group: '操作',
        label: isDark ? '切换到亮色主题' : '切换到暗色主题',
        keywords: 'theme 主题 暗色 亮色 深色',
        icon: <Icon icon={isDark ? sunIcon : moonIcon} width={16} />,
        run: () => setAppearance(isDark ? 'light' : 'dark'),
      },
      {
        id: 'action-logout',
        group: '操作',
        label: '退出登录',
        keywords: 'logout 退出 登出',
        icon: <Icon icon={logOutIcon} width={16} />,
        run: () => {
          logout();
          navigate('/login');
        },
      },
    ];

    return [...pageItems, ...toolItems, ...bookmarkItems, ...actionItems];
  }, [navigate, isAdmin, bookmarks, paletteTools, isDark, setAppearance, logout]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = (it: PaletteItem) =>
      !q ||
      it.label.toLowerCase().includes(q) ||
      (it.keywords ?? '').toLowerCase().includes(q);
    const score = (it: PaletteItem) => {
      if (!q) return 0;
      const label = it.label.toLowerCase();
      return label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
    };
    return GROUP_ORDER.map((group) => {
      const list = items.filter((it) => it.group === group && matched(it));
      // 空查询保持声明顺序（页面/工具按导航顺序）；有查询时前缀命中优先、短标签优先
      if (q) list.sort((a, b) => score(a) - score(b) || a.label.length - b.label.length);
      const cap = q ? (group === '书签' ? 8 : 12) : group === '工具' ? 10 : group === '书签' ? 6 : 20;
      return { group, items: list.slice(0, cap) };
    }).filter((s) => s.items.length > 0);
  }, [items, query]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    flat.forEach((it, i) => map.set(it.id, i));
    return map;
  }, [flat]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setActiveIndex((i) => (flat.length ? Math.min(i, flat.length - 1) : 0));
  }, [flat.length]);

  /** 选中项滚入可视区（不做平滑滚动，减少动态效果下同样可用） */
  useEffect(() => {
    if (!open) return;
    const id = flat[activeIndex]?.id;
    if (!id) return;
    document.getElementById(`vc-palette-item-${id}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, flat, open]);

  const activate = useCallback(
    (item: PaletteItem) => {
      close();
      item.run();
    },
    [close],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!flat.length) return;
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Home') {
      if (!flat.length) return;
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      if (!flat.length) return;
      e.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (e.key === 'Escape') {
      // rc-dialog 会在对话框层 stopPropagation，这里直接处理，保证输入框内 Esc 可关闭
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[activeIndex];
      if (item) activate(item);
    }
  };

  const activeId = flat[activeIndex]?.id;

  return (
    <Modal
      open={open && pathname !== '/login'}
      onCancel={close}
      footer={null}
      closable={false}
      // Esc 由下面 global keydown 统一处理：交给 rc-dialog 会被它在捕获阶段吞掉
      keyboard={false}
      centered
      width={600}
      className="vc-palette"
      afterOpenChange={(visible) => {
        if (visible) inputRef.current?.focus();
      }}
      aria-label="全局搜索"
    >
      <div className="vc-palette__search">
        <Icon icon={searchIcon} width={17} />
        <input
          ref={inputRef}
          className="vc-palette__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="搜索页面、工具、书签…"
          aria-label="全局搜索"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="vc-palette-list"
          aria-autocomplete="list"
          aria-activedescendant={activeId ? `vc-palette-item-${activeId}` : undefined}
          autoFocus
        />
        <span className="vc-kbd">Esc</span>
      </div>

      <div className="vc-palette__list" id="vc-palette-list" role="listbox" aria-label="搜索结果">
        {flat.length === 0 ? (
          <div className="vc-palette__empty">没有匹配结果</div>
        ) : (
          sections.map((section) => (
            <div key={section.group}>
              <div className="vc-palette__group">{section.group}</div>
              {section.items.map((item) => {
                const index = indexOf.get(item.id) ?? 0;
                const active = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    id={`vc-palette-item-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`vc-palette__item${active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => activate(item)}
                  >
                    {item.icon}
                    <span className="vc-palette__item-label">{item.label}</span>
                    {item.hint && <span className="vc-palette__item-hint">{item.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="vc-palette__footer">
        <span>
          <span className="vc-kbd">↑</span>
          <span className="vc-kbd">↓</span> 选择
        </span>
        <span>
          <span className="vc-kbd">Enter</span> 打开
        </span>
        <span>
          <span className="vc-kbd">Ctrl</span>
          <span className="vc-kbd">K</span> 开关
        </span>
      </div>
    </Modal>
  );
};

export default CommandPalette;
