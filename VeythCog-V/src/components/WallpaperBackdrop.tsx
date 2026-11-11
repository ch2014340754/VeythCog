import React from 'react';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';
import { overlayColor } from '@/styles/backgrounds';

/**
 * 动态壁纸全屏层：图片壁纸直接铺在 body 上，视频壁纸只能靠这一层渲染。
 * 位于所有页面内容之下（z-index: -1），不接受鼠标事件。
 *
 * 注意：type 为 video 的壁纸绝对不能用 <img> 渲染（mp4 进 img 只会裂图），
 * 这里统一走 <video autoPlay muted loop playsInline>，并允许浏览器直接向
 * S3 预签名地址发起带 Range 的分段请求。
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
        preload="auto"
        // 视频加载失败时不留纯黑块，直接回退到 body 的主题兜底色
        onError={(e) => {
          const el = e.currentTarget;
          el.style.visibility = 'hidden';
          console.warn('[wallpaper] 动态壁纸加载失败 key=', active.key, el.error?.code, el.error?.message);
        }}
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
