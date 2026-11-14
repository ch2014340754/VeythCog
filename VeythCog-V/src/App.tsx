import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
  return <FloatingMusicPlayer />;
};

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
      <BrowserRouter>
        <WallpaperRouteSync />
        <GlobalMusic />
        <CommandPalette />
        <ErrorBoundary>
          <React.Suspense fallback={<PageLoadingBar />}>
            <Routes>
            {/* 登录页（独立布局） */}
            <Route path="/login" element={<LoginPage />} />

            {/* 受保护路由（主布局） */}
            <Route
              element={
                <RequireAuth>
                  <MainLayout />
                </RequireAuth>
              }
            >
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/tools/*" element={<ToolsLayout />} />

              <Route path="/settings" element={<SettingsPage />}>
                <Route index element={<Navigate to="/settings/account" replace />} />
                <Route path="account" element={<AccountSettings />} />
                <Route path="providers" element={<ProvidersSettings />} />
                <Route path="lark" element={<LarkBindSettings />} />
                <Route path="appearance" element={<AppearanceSettings />} />
              </Route>

              {/* 系统管理（仅管理员） */}
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminPage />
                  </RequireAdmin>
                }
              >
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="roles" element={<AdminRoles />} />
                <Route path="models" element={<AdminModels />} />
                <Route path="monitor" element={<AdminMonitor />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="tasks" element={<AdminTasks />} />
                <Route path="config" element={<AdminConfig />} />
              </Route>
            </Route>

            {/* 兜底 */}
            <Route path="*" element={<Navigate to="/home" replace />} />

            {/* 导航首页（独立布局，不经过 MainLayout） */}
            <Route
              path="/home"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />

            {/* 根路径默认跳首页 */}
            <Route path="/" element={<Navigate to="/home" replace />} />
            </Routes>
          </React.Suspense>
        </ErrorBoundary>
      </BrowserRouter>
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
