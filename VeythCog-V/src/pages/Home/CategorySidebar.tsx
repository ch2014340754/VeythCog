import { useTheme } from '@/contexts/ThemeContext';
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
 * 有壁纸时白色半透明；无壁纸时跟随主题毛玻璃。
 */
const CategorySidebar: React.FC<Props> = ({ onAddCategory }) => {
  const categories = useNavStore((s) => s.categories);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const setActiveCategory = useNavStore((s) => s.setActiveCategory);
  const wallpaper = useWallpaperStore((s) => s.active);
  const { colors } = useTheme();
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const [visible, setVisible] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWallpaperMode = !!wallpaper?.url;

  const scheduleHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 1500);
  }, []);

  const cancelHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  // 毛玻璃与激活态跟全局主题一致；壁纸模式改用白色玻璃变体
  const sidebarBg = isWallpaperMode ? whiteGlass(glassOpacity, 0.06, 0.2) : colors.glassBg;
  const sidebarBorder = isWallpaperMode ? 'rgba(255,255,255,0.14)' : colors.glassBorder;
  const itemActiveBg = isWallpaperMode ? 'rgba(255,255,255,0.2)' : colors.primary10;
  const itemColor = isWallpaperMode ? '#fff' : colors.text;
  const addColor = isWallpaperMode ? 'rgba(255,255,255,0.5)' : colors.textTertiary;

  return (
    <>
      {/* 右边缘 20px 热区：鼠标进入时滑入 */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 20,
          zIndex: 10,
        }}
        onMouseEnter={() => {
          cancelHide();
          setVisible(true);
        }}
      />
      {/* 竖栏本体 */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 64,
          zIndex: 9,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '80px 0 20px',
          gap: 4,
          background: sidebarBg,
          backdropFilter: glassBlur(glassOpacity),
          WebkitBackdropFilter: glassBlur(glassOpacity),
          borderLeft: `1px solid ${sidebarBorder}`,
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s ease-out',
        }}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        {categories.map((c) => {
          const active = c.id === activeCategoryId;
          return (
            <div
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              style={{
                width: 48,
                height: 60,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: active ? itemActiveBg : 'transparent',
                color: itemColor,
                transition: 'background 0.2s',
              }}
            >
              <span style={{ fontSize: 22 }}>{c.icon || '📁'}</span>
              <span style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{c.name}</span>
            </div>
          );
        })}
        {/* 新建分类 */}
        <div
          onClick={onAddCategory}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: addColor,
            fontSize: 20,
          }}
        >
          +
        </div>
      </div>
    </>
  );
};

export default CategorySidebar;
