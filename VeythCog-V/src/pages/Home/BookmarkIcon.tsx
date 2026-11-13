import type { NavBookmark, NavIcon } from '@/api/nav';
import { getBookmarkIcon } from '@/api/nav';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { glassBlur, whiteGlass } from '@/styles/homeSurface';
import { getCachedIcon, iconSignature, setCachedIcon } from '@/utils/iconCache';
import React from 'react';

interface Props {
  bookmark: NavBookmark;
  onEdit?: (b: NavBookmark) => void;
  onDelete?: (b: NavBookmark) => void;
  onContextMenu?: (b: NavBookmark, e: React.MouseEvent) => void;
}

interface PreviewProps {
  icon: NavIcon | null;
  title: string;
  size?: number;
  /** 弹窗预览用：不等毛玻璃效果，走纯色背景 */
  plain?: boolean;
}

/** 文字图标 / 兜底文字的前 3 个字符 */
function initials(title: string): string {
  return (title || '?').trim().slice(0, 3) || '?';
}

/** 按底色亮度取黑 / 白文字，保证浅色底（黄、浅绿）也能看清 */
function readableTextColor(hex?: string | null): string {
  const raw = (hex || '#3B82F6').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (full.length !== 6) return '#fff';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#fff';
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#1F2937' : '#fff';
}

/**
 * 图标渲染原子组件：图片图标优先，失败 / 缺失时回退书名前 3 字。
 * 弹窗预览与首页书签共用同一套渲染规则，避免两处观感不一致。
 */
export const IconPreview: React.FC<PreviewProps> = ({ icon, title, size = 58, plain = false }) => {
  const { colors } = useTheme();
  const wallpaper = useWallpaperStore((s) => s.active);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const [imgError, setImgError] = React.useState(false);

  const isWallpaperMode = !!wallpaper?.url && !plain;
  const imageUrl = icon && icon.type !== 'text' ? icon.url : null;
  React.useEffect(() => setImgError(false), [imageUrl]);

  const isTextIcon = !!icon && icon.type === 'text';
  const iconBg = isWallpaperMode ? whiteGlass(glassOpacity, 0.1, 0.3) : colors.glassBg;
  const iconBorder = isWallpaperMode ? 'rgba(255,255,255,0.28)' : colors.glassBorder;
  const fallbackBg = isWallpaperMode ? 'rgba(0,0,0,0.3)' : colors.surfaceElevated;
  const fallbackColor = isWallpaperMode ? '#fff' : colors.text;

  const imgSize = Math.round(size * 0.9);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.15),
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isTextIcon ? icon.color || '#3B82F6' : imgError || !imageUrl ? fallbackBg : iconBg,
        ...(isTextIcon || plain
          ? {}
          : {
              backdropFilter: glassBlur(glassOpacity),
              WebkitBackdropFilter: glassBlur(glassOpacity),
              border: `1px solid ${iconBorder}`,
            }),
        flexShrink: 0,
      }}
    >
      {isTextIcon ? (
        <span
          style={{
            color: readableTextColor(icon.color),
            fontSize: Math.round(size * 0.3),
            fontWeight: 400,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {(icon.text || '').slice(0, 3) || initials(title)}
        </span>
      ) : imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={title}
          onError={() => setImgError(true)}
          style={{ width: imgSize, height: imgSize, objectFit: 'contain' }}
          loading="lazy"
        />
      ) : (
        <span style={{ color: fallbackColor, fontSize: Math.round(size * 0.28), fontWeight: 500 }}>
          {initials(title)}
        </span>
      )}
    </div>
  );
};

/**
 * 单个书签：图标 + 名称。
 * 图标地址按「本地缓存 → 后端 DB（S3 直链）」两级解析，不再实时请求对方网站 favicon。
 * 右键菜单由 Home 页面全局统一管理（避免多个菜单同时弹出）。
 */
const BookmarkIcon: React.FC<Props> = ({ bookmark, onEdit, onDelete, onContextMenu }) => {
  const { colors } = useTheme();
  const wallpaper = useWallpaperStore((s) => s.active);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);

  const isWallpaperMode = !!wallpaper?.url;
  const nameColor = isWallpaperMode ? '#fff' : colors.text;
  const nameShadow = isWallpaperMode ? '0 1px 4px rgba(0,0,0,0.4)' : 'none';
  const hoverBg = isWallpaperMode ? 'rgba(255,255,255,0.12)' : colors.primary10;
  const actionBg = isWallpaperMode ? 'rgba(0,0,0,0.6)' : colors.surfaceOverlay;
  const actionColor = isWallpaperMode ? '#fff' : colors.text;
  const deleteColor = '#ff6b6b';

  const signature = iconSignature(bookmark);
  const [icon, setIcon] = React.useState<NavIcon | null>(() => getCachedIcon(bookmark));

  React.useEffect(() => {
    let cancelled = false;

    // 命中描述缓存直接渲染，不再请求后端；图片字节由浏览器按 S3 直链自行缓存。
    const cached = getCachedIcon(bookmark);
    if (cached) {
      setIcon(cached);
      return () => {
        cancelled = true;
      };
    }

    setIcon(null);

    // 文字图标不依赖 S3，直接用书签字段渲染，免一次网络往返
    if (bookmark.iconType === 'text' && bookmark.iconText) {
      setIcon({
        type: 'text',
        text: bookmark.iconText,
        color: bookmark.iconColor || '#3B82F6',
      });
      return;
    }
    // 没有 S3 图标对象（未同步 / 同步失败）：直接走书名兜底，不必请求
    if (!bookmark.hasIcon) {
      return;
    }

    getBookmarkIcon(bookmark.id)
      .then((resolved) => {
        if (cancelled) return;
        setIcon(resolved);
        setCachedIcon(bookmark, resolved);
      })
      .catch(() => {
        // 后端不可用时保持兜底渲染，不影响导航本身
      });
    return () => {
      cancelled = true;
    };
    // signature 覆盖图标字段全部变化；bookmark 对象本身每次 load 都是新引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmark.id, signature]);

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
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        padding: 8,
        borderRadius: 12,
        transition: 'background 0.2s',
        position: 'relative',
        height: '100%',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <IconPreview icon={icon} title={bookmark.title} size={58} />
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
