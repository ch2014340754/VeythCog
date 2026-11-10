import React from 'react';
import { useNavStore } from '@/stores/navStore';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * 全屏壁纸层：S3 有壁纸时显示并淡入 + 暗角；
 * S3 未配置时整个层透明，让 body 主题背景（渐变/自定义图）透出。
 * 加载过程中用深色底避免透出 body 背景（避免两种壁纸叠加感）。
 */
const Wallpaper: React.FC = () => {
  const wallpaper = useNavStore((s) => s.wallpaper);
  const { isDark } = useTheme();
  const [loaded, setLoaded] = React.useState(false);

  const bgUrl = wallpaper?.url || '';

  // S3 未配置时透明，透出 body 主题背景
  if (!bgUrl) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        // 加载过程中用深色底，避免透出 body 主题背景
        background: '#1a1a2e',
      }}
    >
      <img
        src={bgUrl}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.8s ease-in-out',
        }}
      />
      {/* 暗角：保证文字可读 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isDark
            ? 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.35) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.35) 100%)',
        }}
      />
    </div>
  );
};

export default Wallpaper;
