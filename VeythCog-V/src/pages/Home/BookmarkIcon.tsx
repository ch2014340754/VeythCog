import React from 'react';
import type { NavBookmark } from '@/api/nav';
import { useTheme } from '@/contexts/ThemeContext';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { glassBlur, whiteGlass } from '@/styles/homeSurface';

interface Props {
  bookmark: NavBookmark;
  onEdit?: (b: NavBookmark) => void;
  onDelete?: (b: NavBookmark) => void;
  onContextMenu?: (b: NavBookmark, e: React.MouseEvent) => void;
}

/**
 * 单个书签图标：logo + 名称。
 * 右键菜单由 Home 页面全局统一管理（避免多个菜单同时弹出）。
 */
const BookmarkIcon: React.FC<Props> = ({ bookmark, onEdit, onDelete, onContextMenu }) => {
  const [imgError, setImgError] = React.useState(false);
  const { colors } = useTheme();
  const wallpaper = useWallpaperStore((s) => s.active);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);

  const isWallpaperMode = !!wallpaper?.url;
  const nameColor = isWallpaperMode ? '#fff' : colors.text;
  const nameShadow = isWallpaperMode ? '0 1px 4px rgba(0,0,0,0.4)' : 'none';
  // 毛玻璃与悬停高亮都走主题：壁纸模式用白色玻璃变体（厚度跟随全局朦胧度）
  const hoverBg = isWallpaperMode ? 'rgba(255,255,255,0.12)' : colors.primary10;
  const iconBg = isWallpaperMode ? whiteGlass(glassOpacity, 0.1, 0.3) : colors.glassBg;
  const iconBorder = isWallpaperMode ? 'rgba(255,255,255,0.28)' : colors.glassBorder;
  const fallbackTextColor = isWallpaperMode ? '#fff' : colors.text;
  const actionBg = isWallpaperMode ? 'rgba(0,0,0,0.6)' : colors.surfaceOverlay;
  const actionColor = isWallpaperMode ? '#fff' : colors.text;
  const deleteColor = '#ff6b6b';

  let host = '';
  try {
    host = new URL(bookmark.url).hostname;
  } catch {
    host = '';
  }
  const faviconUrl = host ? `https://${host}/favicon.ico` : '';

  const handleClick = () => {
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(bookmark, e);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        padding: 8,
        borderRadius: 12,
        transition: 'background 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* 图标（58px） */}
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: imgError ? (isWallpaperMode ? 'rgba(0,0,0,0.3)' : colors.surfaceElevated) : iconBg,
          backdropFilter: glassBlur(glassOpacity),
          WebkitBackdropFilter: glassBlur(glassOpacity),
          border: `1px solid ${iconBorder}`,
        }}
      >
        {imgError || !faviconUrl ? (
          <span style={{ color: fallbackTextColor, fontSize: 16, fontWeight: 500 }}>
            {bookmark.title.slice(0, 3)}
          </span>
        ) : (
          <img
            src={faviconUrl}
            alt={bookmark.title}
            onError={() => setImgError(true)}
            style={{ width: 34, height: 34, objectFit: 'contain' }}
            loading="lazy"
          />
        )}
      </div>
      {/* 名称 */}
      <span
        style={{
          color: nameColor,
          fontSize: 13,
          textShadow: nameShadow,
          maxWidth: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {bookmark.title}
      </span>
      {/* hover 操作按钮 */}
      {(onEdit || onDelete) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            display: 'none',
            gap: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              onClick={() => onEdit(bookmark)}
              style={{
                background: actionBg,
                border: 'none',
                color: actionColor,
                borderRadius: 4,
                width: 20,
                height: 20,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(bookmark)}
              style={{
                background: actionBg,
                border: 'none',
                color: deleteColor,
                borderRadius: 4,
                width: 20,
                height: 20,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BookmarkIcon;
