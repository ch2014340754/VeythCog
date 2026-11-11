import React from 'react';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';
import { overlayColor } from '@/styles/backgrounds';

/**
 * 动态壁纸全屏层：图片壁纸直接铺在 body 上，视频壁纸只能靠这一层渲染。
 * 位于所有页面内容之下（z-index: -1），不接受鼠标事件。
 */
const WallpaperBackdrop: React.FC = () => {
  const active = useWallpaperStore((s) => s.active);
  const overlayOpacity = useSettingsStore((s) => s.overlayOpacity);
  const { isDark } = useTheme();

  if (!active || active.kind !== 'video') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <video
        key={active.key}
        src={active.url}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: overlayColor(overlayOpacity, isDark),
        }}
      />
    </div>
  );
};

export default WallpaperBackdrop;
