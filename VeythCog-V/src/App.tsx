import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { generateAntDTheme } from '@/styles/theme';
import { getPreset } from '@/styles/presets';
import MainLayout from '@/layouts/MainLayout';
import ChatPage from '@/pages/Chat';
import KnowledgePage from '@/pages/Knowledge';
import HomePage from '@/pages/Home';
import ToolsLayout from '@/pages/tools/ToolsLayout';
import LoginPage from '@/pages/Login';
import SettingsPage from '@/pages/Settings';
import AccountSettings from '@/pages/Settings/Account';
import ProvidersSettings from '@/pages/Settings/Providers';
import LarkBindSettings from '@/pages/Settings/LarkBind';
import AppearanceSettings from '@/pages/Settings/Appearance';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';
import AdminPage from '@/pages/Admin';
import AdminUsers from '@/pages/Admin/Users';
import AdminRoles from '@/pages/Admin/Roles';
import AdminModels from '@/pages/Admin/Models';
import AdminMonitor from '@/pages/Admin/Monitoring';
import AdminAudit from '@/pages/Admin/AuditLog';
import AdminTasks from '@/pages/Admin/Tasks';
import AdminConfig from '@/pages/Admin/Config';

/** 路由守卫：未登录跳 /login，并记录来源以便登录后回跳 */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
};

/** 管理员守卫：非管理员重定向回首页 */
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'admin') {
    return <Navigate to="/chat" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { presetName, isDark } = useTheme();

  const antdTheme = useMemo(() => {
    const preset = getPreset(presetName, isDark);
    return generateAntDTheme(preset, isDark);
  }, [presetName, isDark]);

  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <ErrorBoundary>
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
