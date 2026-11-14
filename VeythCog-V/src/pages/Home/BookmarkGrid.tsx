import React from 'react';
import { useNavStore } from '@/stores/navStore';
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
 * 版式（宽度/行列/固定 4 行高度）由 .vc-bookmark-grid-wrap / .vc-bookmark-grid 提供。
 */
const BookmarkGrid: React.FC<Props> = ({ onAddBookmark, onEditBookmark, onContextMenu }) => {
  const bookmarks = useNavStore((s) => s.bookmarks);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const { isDark } = useTheme();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // 切分类后回到顶部，避免把上一分类的滚动位置带过来
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeCategoryId]);

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
    <div className="vc-bookmark-grid-wrap">
      <div
        ref={scrollRef}
        className={`vc-bookmark-grid nav-bookmark-scroll ${isDark ? 'is-dark' : 'is-light'}`}
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
        <button type="button" className="vc-bookmark__add" onClick={onAddBookmark}>
          <span className="vc-bookmark__add-plus">+</span>
          <span className="vc-bookmark__add-text">添加图标</span>
        </button>
      </div>
    </div>
  );
};

export default BookmarkGrid;
