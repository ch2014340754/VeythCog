import React, { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import lockIcon from '@iconify-icons/lucide/lock';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { DEV_BYPASS_TOKEN } from '@/api/auth';
import VeythCogLogo from '@/components/VeythCogLogo';

const LoginPage: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, loading, login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 已登录直接进
  if (token) {
    // 本地绕过模式：刷新后默认进工具集，不进强依赖后端的 /chat
    const from =
      token === DEV_BYPASS_TOKEN
        ? '/tools'
        : ((location.state as { from?: string } | null)?.from ?? '/chat');
    return <Navigate to={from} replace />;
  }

  const onLogin = async () => {
    if (!username.trim()) {
      message.warning('请输入用户名');
      return;
    }
    try {
      await login(username, password);
      // 本地绕过登录（后端未部署）：直接进工具集页，避免 /chat 拉后端数据报错
      const bypassToken = useAuthStore.getState().token === DEV_BYPASS_TOKEN;
      const from = bypassToken
        ? '/tools'
        : ((location.state as { from?: string } | null)?.from ?? '/chat');
      navigate(from, { replace: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
    }
  };

  const onGuest = async () => {
    // 游客入口已移除（后端为真 JWT 登录）
  };
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        padding: 24,
      }}
    >
      <div
        className="glass-effect"
        style={{
          width: 380,
          maxWidth: '100%',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 32px',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Logo + 标题 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} size={56} />
          <div style={{ marginTop: 16, fontSize: 22, fontWeight: 700, color: colors.text }}>
            欢迎回来
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>
            登录以继续使用你的工作空间
          </div>
        </div>

        <Form layout="vertical" onFinish={onLogin}>
          <Form.Item label="用户名" style={{ marginBottom: 16 }}>
            <Input
              size="large"
              placeholder="用户名"
              prefix={<Icon icon={userIcon} width={16} />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </Form.Item>
          <Form.Item label="密码" style={{ marginBottom: 24 }}>
            <Input.Password
              size="large"
              placeholder="密码"
              prefix={<Icon icon={lockIcon} width={16} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={onLogin}
            />
          </Form.Item>
            &nbsp;
          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={onLogin}
            style={{
              background: colors.primary,
              borderColor: colors.primary,
              fontWeight: 600,
            }}
          >
            登 录
          </Button>
        </Form>
      </div>
    </div>
  );
};

export default LoginPage;
