import React from 'react';
import { useNavStore } from '@/stores/navStore';
import { deleteBookmark, type NavBookmark } from '@/api/nav';
import BookmarkIcon from './BookmarkIcon';

interface Props {
  onAddBookmark?: () => void;
  onEditBookmark?: (b: NavBookmark) => void;
  onContextMenu?: (b: NavBookmark, e: React.MouseEvent) => void;
}

/**
 * 书签网格：滚轮切分类由 Home 页面统一接管。
 */
const BookmarkGrid: React.FC<Props> = ({ onAddBookmark, onEditBookmark, onContextMenu }) => {
  const bookmarks = useNavStore((s) => s.bookmarks);
  const { wallpaper } = useNavStore();
  const isWallpaperMode = !!wallpaper?.url;

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
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 12,
          justifyContent: 'center',
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
            gap: 8,
            cursor: 'pointer',
            padding: 8,
            borderRadius: 12,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isWallpaperMode ? 'rgba(255,255,255,0.1)' : 'rgba(128,128,128,0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              border: `2px dashed ${isWallpaperMode ? 'rgba(255,255,255,0.3)' : 'rgba(128,128,128,0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isWallpaperMode ? 'rgba(255,255,255,0.5)' : 'rgba(128,128,128,0.5)',
              fontSize: 28,
            }}
          >
            +
          </div>
          <span style={{ color: isWallpaperMode ? 'rgba(255,255,255,0.7)' : 'rgba(128,128,128,0.7)', fontSize: 12 }}>添加图标</span>
        </div>
      </div>
    </div>
  );
};

export default BookmarkGrid;
