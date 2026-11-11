import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWallpaperStore } from '@/stores/wallpaperStore';

/**
 * 大时钟 + 公历日期 + 星期。
 * 有壁纸时白色文字+阴影；无壁纸时跟随系统主题色。
 */
const Clock: React.FC = () => {
  const [now, setNow] = React.useState(new Date());
  const { colors } = useTheme();
  const wallpaper = useWallpaperStore((s) => s.active);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;

  const isWallpaperMode = !!wallpaper?.url;
  const mainColor = isWallpaperMode ? '#fff' : colors.text;
  const subColor = isWallpaperMode ? 'rgba(255,255,255,0.85)' : colors.textSecondary;
  const mainShadow = isWallpaperMode ? '0 4px 20px rgba(0,0,0,0.4)' : 'none';
  const subShadow = isWallpaperMode ? '0 2px 8px rgba(0,0,0,0.4)' : 'none';

  return (
    <div style={{ textAlign: 'center', color: mainColor, marginBottom: 24 }}>
      <div
        style={{
          fontSize: 96,
          fontWeight: 300,
          letterSpacing: 4,
          lineHeight: 1.1,
          textShadow: mainShadow,
          // 跟随全站字体：标题用 --font-heading，正文用 --font-body
          fontFamily: 'var(--font-heading)',
        }}
      >
        {hh}:{mm}
      </div>
      <div
        style={{
          fontSize: 16,
          marginTop: 8,
          color: subColor,
          textShadow: subShadow,
          fontFamily: 'var(--font-body)',
        }}
      >
        {dateStr}
      </div>
    </div>
  );
};

export default Clock;
