import React from 'react';
import { useNavStore } from '@/stores/navStore';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * 搜索框：居中圆角搜索条，左侧可切换搜索引擎，回车新窗口跳转。
 * 有壁纸时白色半透明+白色文字；无壁纸时跟随主题毛玻璃。
 */
const SearchBar: React.FC = () => {
  const searchEngine = useNavStore((s) => s.searchEngine);
  const setSearchEngine = useNavStore((s) => s.setSearchEngine);
  const wallpaper = useNavStore((s) => s.wallpaper);
  const { colors } = useTheme();
  const [q, setQ] = React.useState('');

  const isWallpaperMode = !!wallpaper?.url;
  const barBg = isWallpaperMode ? 'rgba(255,255,255,0.15)' : colors.glassBg;
  const barBorder = isWallpaperMode ? 'rgba(255,255,255,0.2)' : colors.glassBorder;
  const textColor = isWallpaperMode ? '#fff' : colors.text;
  const btnBg = isWallpaperMode ? 'rgba(255,255,255,0.2)' : colors.primary;
  const btnColor = isWallpaperMode ? '#fff' : colors.textInverse;

  const engines = [
    { key: 'baidu' as const, label: '百度' },
    { key: 'google' as const, label: 'Google' },
    { key: 'bing' as const, label: 'Bing' },
  ];

  const doSearch = () => {
    const query = q.trim();
    if (!query) return;
    const map: Record<string, string> = {
      baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
      google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    };
    window.open(map[searchEngine], '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        maxWidth: 640,
        margin: '0 auto 32px',
        background: barBg,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderRadius: 16,
        padding: '4px 8px',
        border: `1px solid ${barBorder}`,
      }}
    >
      <select
        value={searchEngine}
        onChange={(e) => setSearchEngine(e.target.value as 'baidu' | 'google' | 'bing')}
        style={{
          background: 'transparent',
          border: 'none',
          color: textColor,
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 14,
          outline: 'none',
        }}
      >
        {engines.map((e) => (
          <option key={e.key} value={e.key} style={{ color: '#333' }}>
            {e.label}
          </option>
        ))}
      </select>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        placeholder="输入搜索内容"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: textColor,
          fontSize: 16,
          padding: '8px 12px',
        }}
      />
      <button
        onClick={doSearch}
        style={{
          background: btnBg,
          border: 'none',
          borderRadius: 12,
          color: btnColor,
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: 16,
        }}
      >
        🔍
      </button>
    </div>
  );
};

export default SearchBar;
