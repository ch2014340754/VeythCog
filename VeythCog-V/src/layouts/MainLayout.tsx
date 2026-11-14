import UserMenu from '@/components/UserMenu';
import VeythCogLogo from '@/components/VeythCogLogo';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
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

/**
 * 全站主框架：左侧 72px 浮动导航 rail + 右侧玻璃内容卡。
 * 视觉参数全部来自 page.css 的 .vc-shell / .vc-rail（与 Home 页滑入导航复用同一套类），
 * 壁纸模式下的图标配色由 body.has-bg 变体接管，不再在组件里判断主题。
 */
const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="vc-shell">
      {/* 左侧图标导航栏 - 浮动毛玻璃样式 */}
      <nav className="vc-rail" aria-label="主导航">
        {/* Logo 区域 - 点击回 /home */}
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

        {/* 管理员入口（仅 admin 可见） */}
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

        {/* 用户菜单：头像下拉（账号/模型/飞书/外观/退出） */}
        <UserMenu />
      </nav>

      {/* 右侧内容区 - 留出导航栏空间 */}
      <main className="vc-shell__main">
        <div className="vc-shell__canvas">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
