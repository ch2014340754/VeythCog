import React, { useMemo } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { generateAntDTheme } from '@/styles/theme';
import { getPreset } from '@/styles/presets';
import MainLayout from '@/layouts/MainLayout';
import HomePage from '@/pages/Home';
import CommandPalette from '@/components/CommandPalette';
import ErrorBoundary from '@/components/ErrorBoundary';
import WallpaperBackdrop from '@/components/WallpaperBackdrop';
import FloatingMusicPlayer from '@/components/FloatingMusicPlayer';
import MusicPickerModal from '@/components/MusicPickerModal';
import SelectionAsk from '@/components/SelectionAsk';
import PageLoadingBar from '@/components/PageLoadingBar';
import { PAGE_MODULES, schedulePreloadPages } from '@/routes/lazyPages';
import { useAuthStore } from '@/stores/authStore';
import { useNavStore } from '@/stores/navStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';

// 首屏只保留 /home 需要的依赖；其余页面按路由懒加载，避免把 Chat / Knowledge /
// Tools / Settings / Admin 全部塞进首包（原主包 2.36MB / gzip 731KB）。
// 懒加载清单集中在 routes/lazyPages，首屏稳定后会被预取一遍，切页不再等 chunk。
const ChatPage = React.lazy(PAGE_MODULES.chat);
const KnowledgePage = React.lazy(PAGE_MODULES.knowledge);
const InboxPage = React.lazy(PAGE_MODULES.inbox);
const MusicPage = React.lazy(PAGE_MODULES.music);
const ToolsLayout = React.lazy(PAGE_MODULES.tools);
const LoginPage = React.lazy(PAGE_MODULES.login);
const SettingsPage = React.lazy(PAGE_MODULES.settings);
const AccountSettings = React.lazy(PAGE_MODULES.settingsAccount);
const ProvidersSettings = React.lazy(PAGE_MODULES.settingsProviders);
const LarkBindSettings = React.lazy(PAGE_MODULES.settingsLark);
const AppearanceSettings = React.lazy(PAGE_MODULES.settingsAppearance);
const AdminPage = React.lazy(PAGE_MODULES.admin);
const AdminUsers = React.lazy(PAGE_MODULES.adminUsers);
const AdminRoles = React.lazy(PAGE_MODULES.adminRoles);
const AdminModels = React.lazy(PAGE_MODULES.adminModels);
const AdminMonitor = React.lazy(PAGE_MODULES.adminMonitor);
const AdminAudit = React.lazy(PAGE_MODULES.adminAudit);
const AdminTasks = React.lazy(PAGE_MODULES.adminTasks);
const AdminConfig = React.lazy(PAGE_MODULES.adminConfig);

/** 路由守卫：未登录跳 /login，并记录来源以便登录后回跳 */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    // 保留 query / hash：未登录打开深链，登录后回到原上下文
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <>{children}</>;
};

/** 管理员守卫：非管理员重定向回首页 */
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

/**
 * 壁纸加载分流：
 * - /home 由首页 /nav/bootstrap 聚合接口带回，避免再单独请求 /wallpaper/current；
 * - 其它受保护页面仍单独加载，保证直接刷新 /chat 等页面也有壁纸。
 */
const WallpaperRouteSync: React.FC = () => {
  const { pathname } = useLocation();
  const token = useAuthStore((s) => s.token);
  const loadActiveWallpaper = useWallpaperStore((s) => s.loadActive);

  React.useEffect(() => {
    if (!token || pathname === '/home' || pathname === '/login' || pathname === '/') return;
    loadActiveWallpaper();
  }, [token, pathname, loadActiveWallpaper]);

  return null;
};

/** 全局音乐播放器：受保护页面与首页共用同一实例，登录页不挂载 */
const GlobalMusic: React.FC = () => {
  const { pathname } = useLocation();
  if (pathname === '/login') return null;
  return (
    <>
      <FloatingMusicPlayer />
      <MusicPickerModal />
    </>
  );
};

/** 全局划词 AI：登录页不挂载（没有知识库也没有账号上下文） */
const GlobalSelectionAsk: React.FC = () => {
  const { pathname } = useLocation();
  if (pathname === '/login') return null;
  return <SelectionAsk />;
};

/**
 * 根布局：全局组件需要在 Router 上下文内才能用 useLocation / useNavigate，
 * 因此放进最外层路由的 layout 里，而不是 RouterProvider 之外。
 */
const RootLayout: React.FC = () => (
  <>
    <WallpaperRouteSync />
    <GlobalMusic />
    <GlobalSelectionAsk />
    <CommandPalette />
    <Outlet />
  </>
);

/** 路由表：data router（createBrowserRouter），useBlocker 拦截离开提醒依赖此形态 */
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/chat', element: <ChatPage /> },
      { path: '/knowledge', element: <KnowledgePage /> },
      { path: '/inbox', element: <InboxPage /> },
      { path: '/music', element: <MusicPage /> },
      { path: '/tools/*', element: <ToolsLayout /> },
      {
        path: '/settings',
        element: <SettingsPage />,
        children: [
          { index: true, element: <Navigate to="/settings/account" replace /> },
          { path: 'account', element: <AccountSettings /> },
          { path: 'providers', element: <ProvidersSettings /> },
          { path: 'lark', element: <LarkBindSettings /> },
          { path: 'appearance', element: <AppearanceSettings /> },
        ],
      },
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <Navigate to="/admin/users" replace /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'roles', element: <AdminRoles /> },
          { path: 'models', element: <AdminModels /> },
          { path: 'monitor', element: <AdminMonitor /> },
          { path: 'audit', element: <AdminAudit /> },
          { path: 'tasks', element: <AdminTasks /> },
          { path: 'config', element: <AdminConfig /> },
        ],
      },
    ],
  },
  {
    path: '/home',
    element: (
      <RequireAuth>
        <HomePage />
      </RequireAuth>
    ),
  },
  { path: '/', element: <Navigate to="/home" replace /> },
  { path: '*', element: <Navigate to="/home" replace /> },
    ],
  },
]);

const AppContent: React.FC = () => {
  const { presetName, isDark } = useTheme();
  const token = useAuthStore((s) => s.token);
  const resetWallpaper = useWallpaperStore((s) => s.reset);
  const resetNav = useNavStore((s) => s.reset);

  // 登出清空壁纸和导航本地缓存，避免下一个账号看到上一个账号的数据
  React.useEffect(() => {
    if (!token) {
      resetWallpaper();
      resetNav();
    }
  }, [token, resetWallpaper, resetNav]);

  // 首屏渲染稳定后把其余路由 chunk 预取掉：切页时不再现拉资源、也就不会闪
  React.useEffect(() => schedulePreloadPages(), []);

  const antdTheme = useMemo(() => {
    const preset = getPreset(presetName, isDark);
    return generateAntDTheme(preset, isDark);
  }, [presetName, isDark]);

  return (
    <ConfigProvider theme={antdTheme}>
      <WallpaperBackdrop />
      <ErrorBoundary>
        <React.Suspense fallback={<PageLoadingBar />}>
          <RouterProvider router={router} />
        </React.Suspense>
      </ErrorBoundary>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
