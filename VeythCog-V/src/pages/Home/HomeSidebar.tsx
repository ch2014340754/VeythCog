import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
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
 * Home 页左侧滑入侧边栏：平时隐藏在屏幕左边缘外，鼠标靠近左边缘热区时滑入，离开 1.5s 后滑出。
 * 与 MainLayout 共用 .vc-rail 类（尺寸/玻璃/主题色完全一致），只叠加 .vc-rail--float 的滑入行为。
 */
const HomeSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();
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
      <div className="vc-rail__hotzone" onMouseEnter={show} aria-hidden />

      <nav
        className={`vc-rail vc-rail--float${visible ? ' is-visible' : ''}`}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        aria-label="主导航"
      >
        <button
          type="button"
          className="vc-rail__logo"
          onClick={() => navigate('/home')}
          title="回到导航首页"
        >
          <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} />
        </button>

        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              className={`vc-rail__btn${active ? ' is-active' : ''}`}
              onClick={() => navigate(item.path)}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon icon={item.icon} width={22} />
              {active && <span className="vc-rail__indicator" aria-hidden />}
            </button>
          );
        })}

        <div className="vc-rail__spacer" />

        {isAdmin && (
          <button
            type="button"
            className={`vc-rail__btn${isActive('/admin') ? ' is-active' : ''}`}
            onClick={() => navigate('/admin')}
            title="系统管理"
            aria-current={isActive('/admin') ? 'page' : undefined}
          >
            <Icon icon={shieldIcon} width={22} />
            {isActive('/admin') && <span className="vc-rail__indicator" aria-hidden />}
          </button>
        )}

        <UserMenu />
      </nav>
    </>
  );
};

export default HomeSidebar;