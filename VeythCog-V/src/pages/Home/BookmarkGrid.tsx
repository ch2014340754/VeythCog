import React from 'react';
import { useNavStore } from '@/stores/navStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { deleteBookmark, type NavBookmark } from '@/api/nav';
import { useTheme } from '@/contexts/ThemeContext';
import BookmarkIcon from './BookmarkIcon';

interface Props {
  onAddBookmark?: () => void;
  onEditBookmark?: (b: NavBookmark) => void;
  onContextMenu?: (b: NavBookmark, e: React.MouseEvent) => void;
}

/** 书签网格最多展示 4 行，超出后容器内滚动 */
const ROW_HEIGHT = 100;
const ROW_GAP = 12;
const MAX_VISIBLE_ROWS = 4;
const GRID_MAX_HEIGHT = ROW_HEIGHT * MAX_VISIBLE_ROWS + ROW_GAP * (MAX_VISIBLE_ROWS - 1);

/**
 * 书签网格：滚轮切分类由 Home 页面统一接管。
 */
const BookmarkGrid: React.FC<Props> = ({ onAddBookmark, onEditBookmark, onContextMenu }) => {
  const bookmarks = useNavStore((s) => s.bookmarks);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const wallpaper = useWallpaperStore((s) => s.active);
  const { colors, isDark } = useTheme();
  const isWallpaperMode = !!wallpaper?.url;
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // 切分类后回到顶部，避免把上一分类的滚动位置带过来
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeCategoryId]);

  // 「添加图标」占位卡：无壁纸时跟随主题 token，有壁纸时用白色变体
  const addHoverBg = isWallpaperMode ? 'rgba(255,255,255,0.1)' : colors.primary10;
  const addDashColor = isWallpaperMode ? 'rgba(255,255,255,0.3)' : colors.border;
  const addIconColor = isWallpaperMode ? 'rgba(255,255,255,0.5)' : colors.textTertiary;
  const addTextColor = isWallpaperMode ? 'rgba(255,255,255,0.7)' : colors.textSecondary;

  const handleDelete = async (b: NavBookmark) => {
    if (!confirm(`删除书签「${b.title}」？`)) return;
    try {
      await deleteBookmark(b.id);
      const { loadBookmarks, activeCategoryId: cid } = useNavStore.getState();
      if (cid) loadBookmarks(cid);
    } catch (err) {
      console.error('删除书签失败', err);
    }
  };

  return (
    <div
      style={{
        width: '66.6667vw',
        minWidth: 320,
        maxWidth: 'calc(100vw - 48px)',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={scrollRef}
        className={`nav-bookmark-scroll ${isDark ? 'is-dark' : 'is-light'}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gridAutoRows: ROW_HEIGHT,
          gap: ROW_GAP,
          justifyContent: 'center',
          alignContent: 'start',
          // 固定 4 行高度：各分类图标数不同（3 行 / 撑满 4 行后滚动）时骨架不跳，
          // 切换只换内容、不动版式
          minHeight: GRID_MAX_HEIGHT,
          maxHeight: GRID_MAX_HEIGHT,
          overflowY: 'auto',
          paddingRight: 6,
          boxSizing: 'border-box',
        }}
      >
        {bookmarks.map((b) => (
          <BookmarkIcon
            key={b.id}
            bookmark={b}
            onEdit={onEditBookmark}
            onDelete={handleDelete}
            onContextMenu={onContextMenu}
          />
        ))}
        {/* 添加图标卡片 */}
        <div
          onClick={onAddBookmark}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: 8,
            borderRadius: 12,
            height: '100%',
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = addHoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              border: `2px dashed ${addDashColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: addIconColor,
              fontSize: 28,
            }}
          >
            +
          </div>
          <span style={{ color: addTextColor, fontSize: 13 }}>添加图标</span>
        </div>
      </div>
    </div>
  );
};

export default BookmarkGrid;
