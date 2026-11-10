import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import VeythCogLogo from '@/components/VeythCogLogo';
import UserMenu from '@/components/UserMenu';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import { Icon } from '@iconify/react';

const NAV_ITEMS = [
  { path: '/chat', icon: messageSquareIcon, label: '对话' },
  { path: '/knowledge', icon: bookOpenIcon, label: '知识库' },
  { path: '/tools', icon: wrenchIcon, label: '工具集' },
] as const;

const HIDE_DELAY = 1500;

/**
 * Home 页左侧滑入侧边栏：
 * 平时隐藏在屏幕左边缘外，鼠标靠近左边缘热区时滑入，离开后 1.5s 滑出。
 * 复用 MainLayout 的导航项、Logo、UserMenu，保证全站一致。
 */
const HomeSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [visible, setVisible] = React.useState(false);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const show = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(true);
  };

  const scheduleHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  };

  React.useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* 左边缘热区：宽 20px，鼠标进入触发滑入 */}
      <div
        onMouseEnter={show}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 20,
          zIndex: 90,
        }}
      />

      {/* 侧边栏本体 */}
      <nav
        className="glass-effect"
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
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
          zIndex: 91,
          gap: 4,
          transform: visible ? 'translateX(0)' : 'translateX(-100px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {/* Logo 区域 - 点击回 /home */}
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
          }}
        >
          <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} />
        </div>

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
              }}
              title={item.label}
            >
              <Icon icon={item.icon} width={22} />
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

        <div style={{ flex: 1 }} />

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

        <UserMenu />
      </nav>
    </>
  );
};

export default HomeSidebar;
