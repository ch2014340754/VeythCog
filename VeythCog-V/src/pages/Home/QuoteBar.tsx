import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavStore } from '@/stores/navStore';

/**
 * 底部文案栏：写死 5 条，5s 轮播。
 * 有壁纸时白色+阴影；无壁纸时跟随主题色。
 */
const QUOTES = [
  '「岁至立冬，万物开始一场静默的修行。」',
  '「星光不问赶路人，时光不负有心人。」',
  '「日拱一卒，功不唐捐。」',
  '「把每一个平凡的日子过成不平凡的日子。」',
  '「路虽远行则将至，事虽难做则必成。」',
];

const QuoteBar: React.FC = () => {
  const [idx, setIdx] = React.useState(0);
  const { colors } = useTheme();
  const wallpaper = useNavStore((s) => s.wallpaper);

  React.useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const isWallpaperMode = !!wallpaper?.url;
  const textColor = isWallpaperMode ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const textShadow = isWallpaperMode ? '0 2px 8px rgba(0,0,0,0.4)' : 'none';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: textColor,
        fontSize: 14,
        opacity: 0.8,
        textShadow: textShadow,
        zIndex: 1,
      }}
    >
      {QUOTES[idx]}
    </div>
  );
};

export default QuoteBar;
