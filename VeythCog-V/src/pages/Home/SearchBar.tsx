import React from 'react';
import { Icon } from '@iconify/react';
import searchIcon from '@iconify-icons/lucide/search';
import chevronIcon from '@iconify-icons/lucide/chevron-down';
import { useNavStore } from '@/stores/navStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';
import { glassBlur, whiteGlass } from '@/styles/homeSurface';

/**
 * 搜索框：居中圆角搜索条，左侧可切换搜索引擎，回车新窗口跳转。
 * 有壁纸时白色半透明+白色文字；无壁纸时跟随主题毛玻璃。
 */
const SearchBar: React.FC = () => {
  const searchEngine = useNavStore((s) => s.searchEngine);
  const setSearchEngine = useNavStore((s) => s.setSearchEngine);
  const wallpaper = useWallpaperStore((s) => s.active);
  const { colors } = useTheme();
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const [q, setQ] = React.useState('');
  const [engineOpen, setEngineOpen] = React.useState(false);
  const engineRef = React.useRef<HTMLDivElement>(null);

  const isWallpaperMode = !!wallpaper?.url;
  // 无壁纸：完全用主题玻璃；有壁纸：白色玻璃，厚度与全局「朦胧度」联动
  const barBg = isWallpaperMode
    ? `linear-gradient(180deg, ${whiteGlass(glassOpacity, 0.3, 0.55)} 0%, ${whiteGlass(glassOpacity, 0.16, 0.3)} 100%)`
    : colors.glassBg;
  const barBorder = isWallpaperMode ? 'rgba(255,255,255,0.55)' : colors.glassBorder;
  const barShadow = isWallpaperMode
    ? '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.65)'
    : 'inset 0 1px 0 rgba(255,255,255,0.35)';
  const textColor = isWallpaperMode ? '#fff' : colors.text;
  const textShadow = isWallpaperMode ? '0 1px 3px rgba(0,0,0,0.4)' : 'none';

  // 下拉浮层配色：壁纸模式走深色玻璃，主题模式走亮色磨砂玻璃
  const menuBg = isWallpaperMode ? 'rgba(28,28,38,0.94)' : 'rgba(255,255,255,0.92)';
  const menuBorder = isWallpaperMode ? 'rgba(255,255,255,0.14)' : colors.border;
  const menuHoverBg = isWallpaperMode ? 'rgba(255,255,255,0.12)' : colors.primary10;
  const menuShadow = isWallpaperMode
    ? '0 14px 34px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)'
    : '0 14px 34px rgba(31,35,64,0.16), 0 2px 6px rgba(31,35,64,0.08), inset 0 1px 0 rgba(255,255,255,0.9)';

  const engines = [
    { key: 'baidu' as const, label: '百度' },
    { key: 'google' as const, label: 'Google' },
    { key: 'bing' as const, label: 'Bing' },
  ];
  const currentEngine = engines.find((e) => e.key === searchEngine) ?? engines[0];

  // 点击外部关闭引擎下拉（延后一拍，避免打开它的那次点击立刻关掉）
  React.useEffect(() => {
    if (!engineOpen) return;
    const close = (e: MouseEvent) => {
      if (engineRef.current && !engineRef.current.contains(e.target as Node)) {
        setEngineOpen(false);
      }
    };
    const timer = setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', close);
    };
  }, [engineOpen]);

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
        position: 'relative',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        maxWidth: 640,
        margin: '0 auto 32px',
        background: barBg,
        backdropFilter: glassBlur(glassOpacity),
        WebkitBackdropFilter: glassBlur(glassOpacity),
        borderRadius: 16,
        padding: '4px 8px',
        border: `1px solid ${barBorder}`,
        boxShadow: barShadow,
      }}
    >
      {/* 搜索引擎：主题化下拉，替换原生 select */}
      <div ref={engineRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setEngineOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: textColor,
            textShadow,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 14,
            outline: 'none',
          }}
        >
          {currentEngine.label}
          <Icon
            icon={chevronIcon}
            width={14}
            color={textColor}
            style={{
              opacity: 0.7,
              transform: engineOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s ease',
            }}
          />
        </button>

        {engineOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              minWidth: 136,
              zIndex: 30,
              background: menuBg,
              backdropFilter: 'blur(22px) saturate(170%)',
              WebkitBackdropFilter: 'blur(22px) saturate(170%)',
              border: `1px solid ${menuBorder}`,
              borderRadius: 14,
              padding: 6,
              boxShadow: menuShadow,
            }}
          >
            {engines.map((e) => {
              const active = e.key === searchEngine;
              return (
                <div
                  key={e.key}
                  onClick={() => {
                    setSearchEngine(e.key);
                    setEngineOpen(false);
                  }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = menuHoverBg)}
                  onMouseLeave={(ev) => {
                    ev.currentTarget.style.background = active ? menuHoverBg : 'transparent';
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    letterSpacing: 0.2,
                    cursor: 'pointer',
                    color: textColor,
                    background: active ? menuHoverBg : 'transparent',
                    userSelect: 'none',
                    transition: 'background 0.12s ease',
                  }}
                >
                  {e.label}
                  {active && <Icon icon={chevronIcon} width={12} color={textColor} style={{ opacity: 0.6, transform: 'rotate(-90deg)' }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <input
        className={`nav-search-input${isWallpaperMode ? ' is-white' : ''}`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        placeholder="输入搜索内容"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: textColor,
          textShadow,
          fontSize: 16,
          padding: '8px 12px',
        }}
      />

      {/* 放大镜：纯色字符图标，无按钮底色，颜色与框内文字一致 */}
      <button
        onClick={doSearch}
        title="搜索"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: '8px 12px',
          cursor: 'pointer',
          flexShrink: 0,
          opacity: 0.85,
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
      >
        <Icon icon={searchIcon} width={20} color={textColor} />
      </button>
    </div>
  );
};

export default SearchBar;
