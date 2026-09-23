import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { generateAntDTheme } from '@/styles/theme';
import { getPreset } from '@/styles/presets';
import MainLayout from '@/layouts/MainLayout';
import ChatPage from '@/pages/Chat';
import KnowledgePage from '@/pages/Knowledge';
import ToolsLayout from '@/pages/tools/ToolsLayout';
import LoginPage from '@/pages/Login';
import SettingsPage from '@/pages/Settings';
import AccountSettings from '@/pages/Settings/Account';
import ProvidersSettings from '@/pages/Settings/Providers';
import LarkBindSettings from '@/pages/Settings/LarkBind';
import AppearanceSettings from '@/pages/Settings/Appearance';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';

/** 路由守卫：未登录跳 /login，并记录来源以便登录后回跳 */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
              <Route path="/" element={<Navigate to="/chat" replace />} />
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
            </Route>

            {/* 兜底 */}
            <Route path="*" element={<Navigate to="/chat" replace />} />
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
