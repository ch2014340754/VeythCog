import UserMenu from '@/components/UserMenu';
import VeythCogLogo from '@/components/VeythCogLogo';
import PageLoadingBar from '@/components/PageLoadingBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';
import { useClipStore } from '@/stores/clipStore';
import { resolvePageTitle } from '@/utils/pageTitle';
import { NAV_ITEMS } from '@/config/navItems';
import searchIcon from '@iconify-icons/lucide/search';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import { Icon } from '@iconify/react';
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

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

  // 收件箱角标：进站拉一次 + 60s 轮询（入库/删除后 Inbox 页会主动 refresh，角标立即跟上）
  const clipPending = useClipStore((s) => s.pendingCount);
  const refreshPending = useClipStore((s) => s.refreshPending);
  React.useEffect(() => {
    void refreshPending();
    const timer = window.setInterval(() => void refreshPending(), 60_000);
    return () => window.clearInterval(timer);
  }, [refreshPending]);

  // /tools/:id 的标题由 ToolsLayout 用工具名设置，这里让位避免父级覆盖
  const isToolDetail = location.pathname.startsWith('/tools/');
  useDocumentTitle(isToolDetail ? null : resolvePageTitle(location.pathname));

  const isActive = (path: string) => location.pathname.startsWith(path);

  /** 打开全局命令面板（Ctrl/Cmd+K 的按钮入口，便于鼠标用户发现） */
  const openPalette = () => {
    window.dispatchEvent(new Event('veythcog:open-palette'));
  };

  return (
    <div className="vc-shell">
      {/* 移动端顶栏：首页入口 + 全局搜索 + 账号菜单（桌面端隐藏） */}
      <header className="vc-mobile-header">
        <button
          type="button"
          className="vc-mobile-header__logo"
          onClick={() => navigate('/home')}
          title="回到导航首页"
          aria-label="回到导航首页"
        >
          <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} size={30} />
        </button>
        <div className="vc-mobile-header__actions">
          <button
            type="button"
            className="vc-mobile-header__icon"
            onClick={openPalette}
            title="全局搜索（Ctrl+K）"
            aria-label="全局搜索"
          >
            <Icon icon={searchIcon} width={20} />
          </button>
          <UserMenu />
        </div>
      </header>

      {/* 左侧图标导航栏 - 浮动毛玻璃样式；窄屏转为底部标签栏 */}
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

        {/* 全局搜索：Ctrl/Cmd+K 的命令面板入口 */}
        <button
          type="button"
          className="vc-rail__btn vc-rail__btn--search"
          onClick={openPalette}
          title="全局搜索（Ctrl+K）"
          aria-label="全局搜索"
        >
          <Icon icon={searchIcon} width={22} />
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
              <span className="vc-rail__label">{item.label}</span>
              {active && <span className="vc-rail__indicator" aria-hidden />}
              {item.badge === 'clipPending' && clipPending > 0 && (
                <span className="vc-rail__badge" aria-label={`${clipPending} 条待处理`}>
                  {clipPending > 99 ? '99+' : clipPending}
                </span>
              )}
            </button>
          );
        })}

        <div className="vc-rail__spacer" />

        {/* 管理员入口（仅 admin 可见） */}
        {isAdmin && (
          <button
            type="button"
            className={`vc-rail__btn vc-rail__admin${isActive('/admin') ? ' is-active' : ''}`}
            onClick={() => navigate('/admin')}
            title="系统管理"
            aria-current={isActive('/admin') ? 'page' : undefined}
          >
            <Icon icon={shieldIcon} width={22} />
            <span className="vc-rail__label">管理</span>
            {isActive('/admin') && <span className="vc-rail__indicator" aria-hidden />}
          </button>
        )}

        {/* 桌面端账号菜单；移动端账号菜单挂在顶栏 */}
        <div className="vc-rail__user">
          <UserMenu />
        </div>
      </nav>

      {/* 右侧内容区 - 留出导航栏空间 */}
      <main className="vc-shell__main">
        <div className="vc-shell__canvas">
          {/* 局部 Suspense：页面 chunk 未到位时只出细进度条，外壳（rail + 内容卡）原地不动 */}
          <React.Suspense fallback={<PageLoadingBar docked />}>
            <Outlet />
          </React.Suspense>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
