import type { NavBookmark, NavIcon } from '@/api/nav';
import { getBookmarkIcon } from '@/api/nav';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { glassBlur, whiteGlass } from '@/styles/homeSurface';
import { getCachedIcon, iconSignature, setCachedIcon } from '@/utils/iconCache';
import React from 'react';

interface Props {
  bookmark: NavBookmark;
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
 * 玻璃底/描边由 .vc-iconpreview（含 body.has-bg 白色玻璃变体）提供；
 * 壁纸模式下白色玻璃的透明度仍由 homeSurface.whiteGlass 统一计算，避免另造一套。
 */
export const IconPreview: React.FC<PreviewProps> = ({ icon, title, size = 58, plain = false }) => {
  const wallpaper = useWallpaperStore((s) => s.active);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const [imgError, setImgError] = React.useState(false);

  const isWallpaperMode = !!wallpaper?.url && !plain;
  const imageUrl = icon && icon.type !== 'text' ? icon.url : null;
  React.useEffect(() => setImgError(false), [imageUrl]);

  const isTextIcon = !!icon && icon.type === 'text';
  const isFallback = !isTextIcon && (imgError || !imageUrl);
  /** 图片图标：整块磁贴就是这张图，没有玻璃底、没有留白（见 .vc-iconpreview--img） */
  const isImageIcon = !isTextIcon && !isFallback;

  const cls = [
    'vc-iconpreview',
    isTextIcon ? 'vc-iconpreview--text' : '',
    isImageIcon ? 'vc-iconpreview--img' : '',
    plain && !isTextIcon ? 'vc-iconpreview--plain' : '',
    isFallback ? 'vc-iconpreview--fallback' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // 壁纸模式：白色玻璃图标底（透明度随全局玻璃强度变化）；图片图标已铺满磁贴，不再垫底
  const wallpaperStyle: React.CSSProperties =
    isWallpaperMode && !isTextIcon && !isFallback && !isImageIcon
      ? {
          backgroundColor: whiteGlass(glassOpacity, 0.1, 0.3),
          borderColor: 'rgba(255,255,255,0.28)',
          backdropFilter: glassBlur(glassOpacity),
          WebkitBackdropFilter: glassBlur(glassOpacity),
        }
      : {};

  return (
    <div
      className={cls}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.15),
        // 文字图标用书签自带底色，颜色按底色亮度自动取黑/白
        ...(isTextIcon
          ? { backgroundColor: icon?.color || '#3B82F6', color: readableTextColor(icon?.color) }
          : wallpaperStyle),
      }}
    >
      {isTextIcon ? (
        <span className="vc-iconpreview__text" style={{ fontSize: Math.round(size * 0.3) }}>
          {(icon?.text || '').slice(0, 3) || initials(title)}
        </span>
      ) : imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={title}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      ) : (
        <span className="vc-iconpreview__fallback" style={{ fontSize: Math.round(size * 0.28) }}>
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
const BookmarkIcon: React.FC<Props> = ({ bookmark, onContextMenu }) => {
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
      className="vc-bookmark"
      role="link"
      tabIndex={0}
      title={bookmark.title}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(bookmark, e);
      }}
    >
      <IconPreview icon={icon} title={bookmark.title} size={58} />
      <span className="vc-bookmark__label">{bookmark.title}</span>
    </div>
  );
};

export default BookmarkIcon;
