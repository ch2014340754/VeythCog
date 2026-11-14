import type { NavBookmark } from '@/api/nav';
import { syncIcons } from '@/api/nav';
import WallpaperManagerModal from '@/components/WallpaperManagerModal';
import { useAuthStore } from '@/stores/authStore';
import { useNavStore } from '@/stores/navStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { clearCachedIcon } from '@/utils/iconCache';
import externalLinkIcon from '@iconify-icons/lucide/external-link';
import imageIcon from '@iconify-icons/lucide/image';
import pencilIcon from '@iconify-icons/lucide/pencil';
import plusIcon from '@iconify-icons/lucide/plus';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import trashIcon from '@iconify-icons/lucide/trash-2';
import { Icon } from '@iconify/react';
import { message } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import BookmarkGrid from './BookmarkGrid';
import BookmarkModal from './BookmarkModal';
import CategoryManageModal from './CategoryManageModal';
import CategorySidebar from './CategorySidebar';
import Clock from './Clock';
import HomeDock from './HomeDock';
import HomeSidebar from './HomeSidebar';
import QuoteBar from './QuoteBar';
import SearchBar from './SearchBar';

/**
 * 右键菜单单项：文字在左，图标在右（参照 iTab）
 * 配色/悬停全部由 .vc-home-menu__item 提供（含 body.has-bg 壁纸变体）
 */
interface MenuItemProps {
  label: string;
  icon: typeof externalLinkIcon;
  danger?: boolean;
  onSelect: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ label, icon, danger = false, onSelect }) => (
  <button
    type="button"
    className={"vc-home-menu__item" + (danger ? " is-danger" : "")}
    onClick={onSelect}
  >
    <span>{label}</span>
    <Icon icon={icon} width={15} className="vc-home-menu__icon" />
  </button>
);

/**
 * 导航首页（iTab 风格新标签页）
 * 滚轮热区全页面 + 循环切换
 * 右键菜单全局统一管理，跟随鼠标位置
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const loadHome = useNavStore((s) => s.loadHome);
  const categories = useNavStore((s) => s.categories);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  /** 书签数据实际所属分类：数据到位才变，用它触发切分类的入场动画 */
  const dataCategoryId = useNavStore((s) => s.dataCategoryId);
  const setActiveCategory = useNavStore((s) => s.setActiveCategory);
  // 全站唯一壁纸：由全局 wallpaperStore 管理，首页 bootstrap 会顺手带回当前壁纸
  const activeWallpaper = useWallpaperStore((s) => s.active);
  const applyWallpaper = useWallpaperStore((s) => s.applyActive);
  const loadActiveWallpaper = useWallpaperStore((s) => s.loadActive);
  const switchRandomWallpaper = useWallpaperStore((s) => s.switchRandom);
  const logout = useAuthStore((s) => s.logout);

  const [bookmarkModalOpen, setBookmarkModalOpen] = React.useState(false);
  const [editingBookmark, setEditingBookmark] = React.useState<NavBookmark | null>(null);
  const [categoryManageOpen, setCategoryManageOpen] = React.useState(false);
  const [wallpaperManagerOpen, setWallpaperManagerOpen] = React.useState(false);
  /** 书签图标版块显隐（底部工具条第一个开关，带过渡动画） */
  const [gridVisible, setGridVisible] = React.useState(true);
  /** 右键菜单：书签菜单 / 空白区菜单，同一时间只允许一个 */
  const [menu, setMenu] = React.useState<
    | { kind: 'bookmark'; bookmark: NavBookmark; x: number; y: number }
    | { kind: 'blank'; x: number; y: number }
    | null
  >(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 进入页面：本地缓存先渲染，bootstrap 聚合接口静默刷新并带回壁纸
  React.useEffect(() => {
    let alive = true;
    loadHome().then((data) => {
      if (!alive) return;
      if (data) {
        applyWallpaper(data.wallpaper);
      } else {
        // 聚合接口不可用时退回单接口，保证壁纸不会因一次失败而消失
        loadActiveWallpaper();
      }
    });
    return () => {
      alive = false;
    };
  }, [loadHome, applyWallpaper, loadActiveWallpaper]);

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

  // 全页面滚轮切分类（循环）；书签网格可滚动时优先滚网格
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement | null;

    // AntD Modal 走 portal 渲染，DOM 不在首页下，但 React 事件仍会沿组件树冒泡到这里。
    // 弹窗内滚动时必须直接忽略，否则会同时触发首页分类切换，看起来像“弹窗下的页面跟着滚”。
    if (target?.closest('.ant-modal-root, .ant-drawer-root, .ant-image-preview-root, [data-nav-wheel-ignore]')) {
      return;
    }

    const scroller = target?.closest?.('.nav-bookmark-scroll') as HTMLElement | null;
    if (scroller && e.deltaY !== 0 && scroller.scrollHeight > scroller.clientHeight + 2) {
      const canScrollDown =
        e.deltaY > 0 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2;
      const canScrollUp = e.deltaY < 0 && scroller.scrollTop > 2;
      if (canScrollDown || canScrollUp) return;
    }

    if (debounceRef.current) return;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
    }, 220);

    const idx = categories.findIndex((c) => c.id === activeCategoryId);
    if (idx < 0 || categories.length <= 1) return;

    let nextIdx = idx;
    if (e.deltaY > 0) {
      nextIdx = (idx + 1) % categories.length;
    } else {
      nextIdx = (idx - 1 + categories.length) % categories.length;
    }

    setActiveCategory(categories[nextIdx].id);
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


  return (
    <div className="vc-home" onWheel={handleWheel} onContextMenu={handlePageContextMenu}>
      <HomeSidebar />

      {/* 内容区：fading 只作用在下半的书签区，不作用在壁纸和上半固定区 */}
      <div className="vc-home__content">
        {/* 固定区：时钟 + 搜索框，滚轮切分类时保持不动 */}
        <Clock />
        <SearchBar />

        {/* 切换区：搜索框不参与，只有书签网格从底部弹入。
            key 取 dataCategoryId —— 新分类的书签真正到位时才重挂载、播一次；
            同一分类内的静默刷新（图标同步完成）不会重播。
            外层 wrapper 承担版块显隐过渡（opacity / 位移 / 高度）。 */}
        <div className={"vc-home__grid-shell" + (gridVisible ? "" : " is-hidden")}>
          <div key={dataCategoryId ?? 'nav-empty'} className="vc-nav-pop vc-home__grid-pop">
            <BookmarkGrid
              onAddBookmark={handleAddBookmark}
              onContextMenu={(b, e) => setMenu({ kind: 'bookmark', bookmark: b, x: e.clientX, y: e.clientY })}
            />
          </div>
        </div>
      </div>

      <CategorySidebar onAddCategory={() => setCategoryManageOpen(true)} />
      <QuoteBar />
      <HomeDock gridVisible={gridVisible} onToggleGrid={() => setGridVisible((v) => !v)} />

      {/* 全局右键菜单：书签菜单 / 空白区菜单共用一个容器 */}
      {menu && (
        <div
          className="vc-home-menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 220),
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.kind === 'bookmark' ? (
            <>
              <MenuItem
                label="在新标签页打开"
                icon={externalLinkIcon}
                onSelect={() => {
                  window.open(menu.bookmark.url, '_blank', 'noopener,noreferrer');
                  setMenu(null);
                }}
              />
              <MenuItem label="编辑图标" icon={pencilIcon} onSelect={() => handleEditBookmark(menu.bookmark)} />
              <MenuItem
                label="删除"
                icon={trashIcon}
                danger
                onSelect={() => handleDeleteBookmark(menu.bookmark)}
              />
            </>
          ) : (
            <>
              <MenuItem
                label="新增图标"
                icon={plusIcon}
                onSelect={() => {
                  setMenu(null);
                  handleAddBookmark();
                }}
              />
              <MenuItem
                label="切换壁纸"
                icon={refreshIcon}
                onSelect={() => {
                  setMenu(null);
                  switchRandomWallpaper();
                }}
              />
              <MenuItem
                label="壁纸管理"
                icon={imageIcon}
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
