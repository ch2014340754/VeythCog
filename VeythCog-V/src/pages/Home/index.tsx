import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { Icon } from '@iconify/react';
import externalLinkIcon from '@iconify-icons/lucide/external-link';
import pencilIcon from '@iconify-icons/lucide/pencil';
import trashIcon from '@iconify-icons/lucide/trash-2';
import plusIcon from '@iconify-icons/lucide/plus';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import imageIcon from '@iconify-icons/lucide/image';
import Clock from './Clock';
import SearchBar from './SearchBar';
import BookmarkGrid from './BookmarkGrid';
import CategorySidebar from './CategorySidebar';
import HomeSidebar from './HomeSidebar';
import BookmarkModal from './BookmarkModal';
import CategoryManageModal from './CategoryManageModal';
import QuoteBar from './QuoteBar';
import WallpaperManagerModal from '@/components/WallpaperManagerModal';
import { useNavStore } from '@/stores/navStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import type { NavBookmark } from '@/api/nav';
import { syncIcons } from '@/api/nav';
import { clearCachedIcon } from '@/utils/iconCache';

/**
 * 右键菜单单项：文字在左，图标在右（参照 iTab）
 */
interface MenuItemProps {
  label: string;
  icon: typeof externalLinkIcon;
  color: string;
  hoverBg: string;
  onSelect: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ label, icon, color, hoverBg, onSelect }) => (
  <div
    onClick={onSelect}
    onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '10px 12px',
      borderRadius: 8,
      cursor: 'pointer',
      fontSize: 13,
      color,
      userSelect: 'none',
      transition: 'background 0.15s ease',
    }}
  >
    <span>{label}</span>
    <Icon icon={icon} width={15} style={{ opacity: 0.75, flexShrink: 0 }} />
  </div>
);

/**
 * 导航首页（iTab 风格新标签页）
 * 滚轮热区全页面 + 循环切换
 * 右键菜单全局统一管理，跟随鼠标位置
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const loadCategories = useNavStore((s) => s.loadCategories);
  const loadSetting = useNavStore((s) => s.loadSetting);
  const categories = useNavStore((s) => s.categories);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const setActiveCategory = useNavStore((s) => s.setActiveCategory);
  // 全站唯一壁纸：由全局 wallpaperStore 管理，导航页只负责入口
  const activeWallpaper = useWallpaperStore((s) => s.active);
  const switchRandomWallpaper = useWallpaperStore((s) => s.switchRandom);
  const logout = useAuthStore((s) => s.logout);

  const [bookmarkModalOpen, setBookmarkModalOpen] = React.useState(false);
  const [editingBookmark, setEditingBookmark] = React.useState<NavBookmark | null>(null);
  const [categoryManageOpen, setCategoryManageOpen] = React.useState(false);
  const [wallpaperManagerOpen, setWallpaperManagerOpen] = React.useState(false);
  const [fading, setFading] = React.useState(false);
  /** 右键菜单：书签菜单 / 空白区菜单，同一时间只允许一个 */
  const [menu, setMenu] = React.useState<
    | { kind: 'bookmark'; bookmark: NavBookmark; x: number; y: number }
    | { kind: 'blank'; x: number; y: number }
    | null
  >(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 进入页面
  React.useEffect(() => {
    loadSetting();
    loadCategories();
  }, [loadSetting, loadCategories]);

  // 进页面后触发一次「缺失图标补齐」：后端只挑 icon_type=auto 且没有 icon_key 的书签，
  // 已同步过 / 失败冷却中的会直接跳过，因此可以安全地每次进页面调用。延后 1.5s 不抢首屏。
  React.useEffect(() => {
    const timer = setTimeout(() => {
      syncIcons()
        .then((result) => {
          // 补齐成功后静默刷新当前分类，让新拿到的图标立刻生效
          if (result?.success > 0) {
            const { activeCategoryId: cid, loadBookmarks } = useNavStore.getState();
            if (cid) loadBookmarks(cid);
          }
        })
        .catch((err) => {
          console.warn('[Home] 同步导航图标失败', err);
        });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 点击任意位置关闭右键菜单
  // 1) 不监听 contextmenu，否则右键打开新菜单会被同一次事件立刻关掉
  // 2) 延后一拍再挂 mousedown，避免打开菜单的那次右键/左键事件回头把菜单关掉
  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    let attached = false;
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('scroll', close);
      attached = true;
    }, 0);
    return () => {
      clearTimeout(timer);
      if (attached) {
        window.removeEventListener('mousedown', close);
        window.removeEventListener('scroll', close);
      }
    };
  }, [menu]);

  // 全页面滚轮切分类（循环）
  const handleWheel = (e: React.WheelEvent) => {
    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
    }, 300);

    const idx = categories.findIndex((c) => c.id === activeCategoryId);
    if (idx < 0 || categories.length <= 1) return;

    let nextIdx = idx;
    if (e.deltaY > 0) {
      nextIdx = (idx + 1) % categories.length;
    } else {
      nextIdx = (idx - 1 + categories.length) % categories.length;
    }

    setFading(true);
    setActiveCategory(categories[nextIdx].id);
    setTimeout(() => setFading(false), 300);
  };

  // 空白处右键：新增图标 / 换张壁纸
  const handlePageContextMenu = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    // 输入类控件保留系统右键菜单
    if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    setMenu({ kind: 'blank', x: e.clientX, y: e.clientY });
  };

  const handleAddBookmark = () => {
    setEditingBookmark(null);
    setBookmarkModalOpen(true);
  };

  const handleEditBookmark = (b: NavBookmark) => {
    setEditingBookmark(b);
    setBookmarkModalOpen(true);
    setMenu(null);
  };

  const handleDeleteBookmark = async (b: NavBookmark) => {
    setMenu(null);
    if (!confirm(`删除书签「${b.title}」？`)) return;
    try {
      const { deleteBookmark } = await import('@/api/nav');
      await deleteBookmark(b.id);
      clearCachedIcon(b.id);
      const { loadBookmarks, activeCategoryId: cid } = useNavStore.getState();
      if (cid) loadBookmarks(cid);
    } catch (err) {
      console.error('删除书签失败', err);
    }
  };

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('/login');
  };

  const isWallpaperMode = !!activeWallpaper;
  const menuBg = isWallpaperMode ? 'rgba(30,30,40,0.92)' : colors.surfaceOverlay;
  const menuBorder = isWallpaperMode ? 'rgba(255,255,255,0.12)' : colors.border;
  const menuItemColor = isWallpaperMode ? 'rgba(255,255,255,0.9)' : colors.text;
  const menuHoverBg = isWallpaperMode ? 'rgba(255,255,255,0.1)' : 'rgba(128,128,128,0.1)';

  return (
    <div
      onWheel={handleWheel}
      onContextMenu={handlePageContextMenu}
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <HomeSidebar />

      {/* 内容区：fading 只作用在下半的书签区，不作用在壁纸和上半固定区 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '12vh 24px 80px',
        }}
      >
        {/* 固定区：时钟 + 搜索框，滚轮切分类时保持不动 */}
        <Clock />
        <SearchBar />

        {/* 切换区：仅书签网格随分类切换淡出，搜索框不参与 */}
        <div
          style={{
            opacity: fading ? 0.3 : 1,
            transition: 'opacity 0.25s ease',
            paddingTop: '80px',
          }}
        >
          <BookmarkGrid
            onAddBookmark={handleAddBookmark}
            onEditBookmark={handleEditBookmark}
            onContextMenu={(b, e) => setMenu({ kind: 'bookmark', bookmark: b, x: e.clientX, y: e.clientY })}
          />
        </div>
      </div>

      <CategorySidebar onAddCategory={() => setCategoryManageOpen(true)} />
      <QuoteBar />

      {/* 全局右键菜单：书签菜单 / 空白区菜单共用一个容器 */}
      {menu && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 220),
            zIndex: 1000,
            minWidth: 168,
            borderRadius: 12,
            overflow: 'hidden',
            background: menuBg,
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: `1px solid ${menuBorder}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            padding: 4,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.kind === 'bookmark' ? (
            <>
              <MenuItem
                label="在新标签页打开"
                icon={externalLinkIcon}
                color={menuItemColor}
                hoverBg={menuHoverBg}
                onSelect={() => {
                  window.open(menu.bookmark.url, '_blank', 'noopener,noreferrer');
                  setMenu(null);
                }}
              />
              <MenuItem
                label="编辑图标"
                icon={pencilIcon}
                color={menuItemColor}
                hoverBg={menuHoverBg}
                onSelect={() => handleEditBookmark(menu.bookmark)}
              />
              <MenuItem
                label="删除"
                icon={trashIcon}
                color={isWallpaperMode ? '#ff6b6b' : colors.error}
                hoverBg={menuHoverBg}
                onSelect={() => handleDeleteBookmark(menu.bookmark)}
              />
            </>
          ) : (
            <>
              <MenuItem
                label="新增图标"
                icon={plusIcon}
                color={menuItemColor}
                hoverBg={menuHoverBg}
                onSelect={() => {
                  setMenu(null);
                  handleAddBookmark();
                }}
              />
              <MenuItem
                label="切换壁纸"
                icon={refreshIcon}
                color={menuItemColor}
                hoverBg={menuHoverBg}
                onSelect={() => {
                  setMenu(null);
                  switchRandomWallpaper();
                }}
              />
              <MenuItem
                label="壁纸管理"
                icon={imageIcon}
                color={menuItemColor}
                hoverBg={menuHoverBg}
                onSelect={() => {
                  setMenu(null);
                  setWallpaperManagerOpen(true);
                }}
              />
            </>
          )}
        </div>
      )}

      <BookmarkModal
        open={bookmarkModalOpen}
        onClose={() => setBookmarkModalOpen(false)}
        editing={editingBookmark}
      />
      <CategoryManageModal
        open={categoryManageOpen}
        onClose={() => setCategoryManageOpen(false)}
      />
      <WallpaperManagerModal
        open={wallpaperManagerOpen}
        onClose={() => setWallpaperManagerOpen(false)}
      />
    </div>
  );
};

export default HomePage;
