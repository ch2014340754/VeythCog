import { useNavStore } from '@/stores/navStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { glassBlur, whiteGlass } from '@/styles/homeSurface';
import React from 'react';

interface Props {
  onAddCategory?: () => void;
}

/**
 * 右侧竖排分类栏：
 * - 平时隐藏（translateX(100%)）
 * - 鼠标靠近右边缘 20px 热区时滑入
 * - 鼠标离开竖栏本体后延迟 1.5s 滑出
 * 有壁纸时白色半透明；无壁纸时跟随主题毛玻璃（.vc-catnav + body.has-bg 变体）。
 */
const CategorySidebar: React.FC<Props> = ({ onAddCategory }) => {
  const categories = useNavStore((s) => s.categories);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const setActiveCategory = useNavStore((s) => s.setActiveCategory);
  const wallpaper = useWallpaperStore((s) => s.active);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const [visible, setVisible] = React.useState(false);
  /** 当前 hover 的分类 id：给非激活项一个轻反馈 */
  const [hoverId, setHoverId] = React.useState<number | null>(null);
  /** 按下中的分类 id：按下时轻微缩放，和 iTab 的手感一致 */
  const [pressedId, setPressedId] = React.useState<number | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWallpaperMode = !!wallpaper?.url;

  const scheduleHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 1500);
  }, []);

  const cancelHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  // 毛玻璃与激活态跟全局主题一致；壁纸模式改用白色玻璃变体（homeSurface 统一口径）
  const wallpaperStyle: React.CSSProperties = isWallpaperMode
    ? {
        background: whiteGlass(glassOpacity, 0.06, 0.2),
        borderLeftColor: 'rgba(255,255,255,0.14)',
        backdropFilter: glassBlur(glassOpacity),
        WebkitBackdropFilter: glassBlur(glassOpacity),
      }
    : {};

  // 激活态滑块几何：分类项固定 60 高、间距 4，从 padding-top 80px 起排
  const ITEM_HEIGHT = 60;
  const ITEM_GAP = 4;
  const LIST_PAD_TOP = 80;
  const ITEM_LEFT = 8; // 竖栏宽 64，项宽 48，居中
  const activeIndex = categories.findIndex((c) => c.id === activeCategoryId);

  return (
    <>
      {/* 右边缘 20px 热区：鼠标进入时滑入 */}
      <div
        className="vc-catnav__hotzone"
        onMouseEnter={() => {
          cancelHide();
          setVisible(true);
        }}
      />
      {/* 竖栏本体 */}
      <div
        className={`vc-catnav${visible ? ' is-visible' : ''}`}
        style={wallpaperStyle}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        {/* 激活态滑块：整块圆角背景跟着选中项移动，比逐项变色顺 */}
        {activeIndex >= 0 && (
          <div
            aria-hidden
            className="vc-catnav__thumb"
            style={{
              top: LIST_PAD_TOP,
              left: ITEM_LEFT,
              height: ITEM_HEIGHT,
              transform: `translateY(${activeIndex * (ITEM_HEIGHT + ITEM_GAP)}px)`,
            }}
          />
        )}
        {categories.map((c) => {
          const active = c.id === activeCategoryId;
          return (
            <button
              key={c.id}
              type="button"
              className={`vc-catnav__item${pressedId === c.id ? ' is-pressed' : ''}`}
              style={{ height: ITEM_HEIGHT }}
              title={c.name}
              aria-pressed={active}
              onClick={() => setActiveCategory(c.id)}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => {
                setHoverId((h) => (h === c.id ? null : h));
                setPressedId((p) => (p === c.id ? null : p));
              }}
              onMouseDown={() => setPressedId(c.id)}
              onMouseUp={() => setPressedId(null)}
            >
              <span className="vc-catnav__emoji">{c.icon || '📁'}</span>
              <span className="vc-catnav__label">{c.name}</span>
            </button>
          );
        })}
        {/* 新建分类 */}
        <button
          type="button"
          className="vc-catnav__add"
          title="新建分类"
          aria-label="新建分类"
          onClick={onAddCategory}
        >
          +
        </button>
      </div>
    </>
  );
};

export default CategorySidebar;
