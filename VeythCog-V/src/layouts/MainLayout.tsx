import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import UserMenu from '@/components/UserMenu';
import FloatingMusicPlayer from '@/components/FloatingMusicPlayer';
import VeythCogLogo from '@/components/VeythCogLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';

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
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

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
          top: 16,
          left: 16,
          bottom: 16,
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
        {/* Logo 区域 - 渡思 VeythCog 内联标识 */}
        <div
          style={{
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
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
                color: active ? colors.primary : colors.textSecondary,
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
              color: isActive('/admin') ? colors.primary : colors.textSecondary,
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
          marginLeft: 104, // 72 + 16 + 16 间距
          flex: 1,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <Outlet />
      </main>

      {/* 全局浮动音乐播放器（mock） */}
      <FloatingMusicPlayer />
    </div>
  );
};

export default MainLayout;