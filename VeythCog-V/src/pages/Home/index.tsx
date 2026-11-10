import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import Wallpaper from './Wallpaper';
import Clock from './Clock';
import SearchBar from './SearchBar';
import BookmarkGrid from './BookmarkGrid';
import CategorySidebar from './CategorySidebar';
import HomeSidebar from './HomeSidebar';
import BookmarkModal from './BookmarkModal';
import CategoryManageModal from './CategoryManageModal';
import QuoteBar from './QuoteBar';
import { useNavStore } from '@/stores/navStore';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import type { NavBookmark } from '@/api/nav';

/**
 * 导航首页（iTab 风格新标签页）
 * 滚轮热区全页面 + 循环切换
 * 右键菜单全局统一管理，跟随鼠标位置
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const loadCategories = useNavStore((s) => s.loadCategories);
  const loadRandomWallpaper = useNavStore((s) => s.loadRandomWallpaper);
  const loadSetting = useNavStore((s) => s.loadSetting);
  const categories = useNavStore((s) => s.categories);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const setActiveCategory = useNavStore((s) => s.setActiveCategory);
  const logout = useAuthStore((s) => s.logout);

  const [bookmarkModalOpen, setBookmarkModalOpen] = React.useState(false);
  const [editingBookmark, setEditingBookmark] = React.useState<NavBookmark | null>(null);
  const [categoryManageOpen, setCategoryManageOpen] = React.useState(false);
  const [fading, setFading] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ bookmark: NavBookmark; x: number; y: number } | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 进入页面
  React.useEffect(() => {
    loadSetting();
    loadCategories();
    loadRandomWallpaper();
  }, [loadSetting, loadCategories, loadRandomWallpaper]);

  // 点击任意位置关闭右键菜单
  React.useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('scroll', close);
    };
  }, [contextMenu]);

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

  const handleAddBookmark = () => {
    setEditingBookmark(null);
    setBookmarkModalOpen(true);
  };

  const handleEditBookmark = (b: NavBookmark) => {
    setEditingBookmark(b);
    setBookmarkModalOpen(true);
    setContextMenu(null);
  };

  const handleDeleteBookmark = async (b: NavBookmark) => {
    setContextMenu(null);
    if (!confirm(`删除书签「${b.title}」？`)) return;
    try {
      const { deleteBookmark } = await import('@/api/nav');
      await deleteBookmark(b.id);
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

  const wallpaper = useNavStore((s) => s.wallpaper);
  const isWallpaperMode = !!wallpaper?.url;
  const menuBg = isWallpaperMode ? 'rgba(30,30,40,0.92)' : colors.surfaceOverlay;
  const menuBorder = isWallpaperMode ? 'rgba(255,255,255,0.12)' : colors.border;
  const menuItemColor = isWallpaperMode ? 'rgba(255,255,255,0.9)' : colors.text;

  return (
    <div
      onWheel={handleWheel}
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <Wallpaper />
      <HomeSidebar />

      {/* 内容区：fading 只作用在这里，不作用在壁纸上 */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '12vh 24px 80px',
          opacity: fading ? 0.3 : 1,
          transition: 'opacity 0.25s ease',
        }}
      >
        <Clock />
        <SearchBar />
        <BookmarkGrid
          onAddBookmark={handleAddBookmark}
          onEditBookmark={handleEditBookmark}
          onContextMenu={(b, e) => setContextMenu({ bookmark: b, x: e.clientX, y: e.clientY })}
        />
      </div>

      <CategorySidebar onAddCategory={() => setCategoryManageOpen(true)} />
      <QuoteBar />

      {/* 全局右键菜单 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            minWidth: 160,
            borderRadius: 12,
            overflow: 'hidden',
            background: menuBg,
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: `1px solid ${menuBorder}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            padding: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: menuItemColor,
            }}
            onClick={() => {
              window.open(contextMenu.bookmark.url, '_blank', 'noopener,noreferrer');
              setContextMenu(null);
            }}
          >
            <span>🔗</span> 在新标签页打开
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: menuItemColor,
            }}
            onClick={() => handleEditBookmark(contextMenu.bookmark)}
          >
            <span>✏️</span> 编辑图标
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: isWallpaperMode ? '#ff6b6b' : colors.error,
            }}
            onClick={() => handleDeleteBookmark(contextMenu.bookmark)}
          >
            <span>🗑</span> 删除
          </div>
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
    </div>
  );
};

export default HomePage;
