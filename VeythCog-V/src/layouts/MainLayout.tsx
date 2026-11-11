import FloatingMusicPlayer from '@/components/FloatingMusicPlayer';
import UserMenu from '@/components/UserMenu';
import VeythCogLogo from '@/components/VeythCogLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import { Icon } from '@iconify/react';
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/chat', icon: messageSquareIcon, label: '对话' },
  { path: '/knowledge', icon: bookOpenIcon, label: '知识库' },
  { path: '/tools', icon: wrenchIcon, label: '工具集' },
] as const;

const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  // 有壁纸时导航图标不再用主题灰（半透明毛玻璃 + 深色壁纸下会糊成一片），改用近白色
  const hasWallpaper = useWallpaperStore((s) => s.active !== null);
  const idleIconColor = hasWallpaper ? 'rgba(255,255,255,0.88)' : colors.textSecondary;

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        // 外层容器透明，让 body 上的背景（含自定义背景图）透出；无背景时由 body 的 --color-bg 兜底
        background: 'transparent',
      }}
    >
      {/* 左侧图标导航栏 - 浮动毛玻璃样式 */}
      <nav
        className="glass-effect"
        style={{
          position: 'fixed',
          top: 10,
          left: 10,
          bottom: 10,
          width: 72,
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          zIndex: 'var(--z-fixed)',
          gap: 4,
        }}
      >
        {/* Logo 区域 - 点击回 /home，丝滑 hover */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate('/home')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/home');
            }
          }}
          style={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            transition: `all 0.2s var(--spring)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.primary10;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          title="回到导航首页"
        >
          <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} />
        </div>

        {/* 导航项：透明底 + 左侧指示条 + primary 字，去掉实心背景避免与主题按钮撞色 */}
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <div
              key={item.path}
              role="button"
              tabIndex={0}
              onClick={() => navigate(item.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(item.path);
                }
              }}
              style={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: active ? colors.primary10 : 'transparent',
                color: active ? colors.primary : idleIconColor,
                transition: `all 0.2s var(--spring)`,
                position: 'relative',
                outline: 'none',
                backdropFilter: active && glassEnabled ? 'blur(8px) saturate(160%)' : undefined,
                WebkitBackdropFilter: active && glassEnabled ? 'blur(8px) saturate(160%)' : undefined,
              }}
              title={item.label}
            >
              <Icon icon={item.icon} width={22} />
              {/* 活跃指示条 */}
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    left: -12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 20,
                    borderRadius: 2,
                    background: colors.primary,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* 底部弹性空间 */}
        <div style={{ flex: 1 }} />

        {/* 管理员入口（仅 admin 可见） */}
        {isAdmin && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/admin');
              }
            }}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              marginBottom: 4,
              background: isActive('/admin') ? colors.primary10 : 'transparent',
              color: isActive('/admin') ? colors.primary : idleIconColor,
              transition: `all 0.2s var(--spring)`,
              outline: 'none',
            }}
            title="系统管理"
          >
            <Icon icon={shieldIcon} width={22} />
          </div>
        )}

        {/* 用户菜单：头像下拉（账号/模型/飞书/外观/退出） */}
        <UserMenu />
      </nav>

      {/* 右侧内容区 - 留出导航栏空间 */}
      <main
        style={{
          marginLeft: 92, // 72 + 10 + 10 间距
          flex: 1,
          height: '100vh',
          overflow: 'hidden',
          padding: '10px 10px 10px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            background: colors.glassBg,
            backdropFilter: `blur(${Math.round(2 + (glassOpacity / 100) * 28)}px) saturate(160%)`,
            WebkitBackdropFilter: `blur(${Math.round(2 + (glassOpacity / 100) * 28)}px) saturate(160%)`,
            border: `1px solid ${colors.glassBorder}`,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <Outlet />
        </div>
      </main>

      {/* 全局浮动音乐播放器（mock） */}
      <FloatingMusicPlayer />
    </div>
  );
};

export default MainLayout;