import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, message, Radio, Divider } from 'antd';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import lockIcon from '@iconify-icons/lucide/lock';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { useModeStore } from '@/stores/modeStore';
import { register as authRegister } from '@/api/auth';
import { MOCK_TOKEN } from '@/config';
import VeythCogLogo from '@/components/VeythCogLogo';

type Mode = 'login' | 'register';

const LoginPage: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, loading, login } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');

  // 登录表单
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 注册表单
  const [nickname, setNickname] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registering, setRegistering] = useState(false);

  // 注册成功 → 3 秒倒计时 → 自动登录
  const [pendingAutoLogin, setPendingAutoLogin] = useState<{ username: string; password: string } | null>(null);
  const [countdown, setCountdown] = useState(0);

  // 运行模式：本地绕过 / 真实后端联调（持久化在 modeStore）
  const bypassMode = useModeStore((s) => s.bypassMode);
  const apiBase = useModeStore((s) => s.apiBase);
  const [apiBaseInput, setApiBaseInput] = useState(apiBase);

  const onModeChange = (e: any) => {
    const v = e.target.value;
    if (v === 'real') {
      useModeStore.getState().setBypassMode(false);
    } else {
      useModeStore.getState().setBypassMode(true);
    }
  };

  const onApiBaseBlur = () => {
    const v = apiBaseInput.trim().replace(/\/+$/, '');
    if (v) useModeStore.getState().setApiBase(v);
  };

  const onLogin = async () => {
    if (!username.trim()) {
      message.warning('请输入用户名');
      return;
    }
    try {
      await login(username, password);
      // mock 模式（后端未部署）直接进工具集，避免 /chat 拉后端数据报错
      const mockToken = useAuthStore.getState().token === MOCK_TOKEN;
      const from = mockToken
        ? '/tools'
        : ((location.state as { from?: string } | null)?.from ?? '/chat');
      navigate(from, { replace: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
    }
  };

  const onRegister = async () => {
    if (!username.trim()) {
      message.warning('请输入用户名');
      return;
    }
    if (password.length < 6) {
      message.warning('密码至少 6 位');
      return;
    }
    if (password !== confirmPassword) {
      message.warning('两次输入的密码不一致');
      return;
    }
    setRegistering(true);
    try {
      await authRegister({ username, password, nickname });
      setRegistering(false);
      // 注册成功 → 3 秒后自动登录
      setPendingAutoLogin({ username: username.trim(), password });
      setCountdown(3);
    } catch (e) {
      setRegistering(false);
      message.error(e instanceof Error ? e.message : '注册失败');
    }
  };

  const doAutoLogin = async () => {
    if (!pendingAutoLogin) return;
    try {
      await useAuthStore.getState().login(pendingAutoLogin.username, pendingAutoLogin.password);
      const t = useAuthStore.getState().token;
      navigate(t === MOCK_TOKEN ? '/tools' : '/chat', { replace: true });
    } catch {
      message.error('自动登录失败，请手动登录');
      setMode('login');
      setPendingAutoLogin(null);
      setCountdown(0);
    }
  };

  // 倒计时驱动：每秒减一，减到 0 触发自动登录
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        void doAutoLogin();
      } else {
        setCountdown((c) => c - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // 已登录直接进（必须放在所有 hooks 之后，否则条件提前返回会导致 hooks 数量不一致）
  if (token) {
    const from =
      token === MOCK_TOKEN
        ? '/tools'
        : ((location.state as { from?: string } | null)?.from ?? '/chat');
    return <Navigate to={from} replace />;
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setPendingAutoLogin(null);
    setCountdown(0);
  };

  const tabBtnStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    border: 'none',
    background: 'transparent',
    padding: '8px 0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 999,
    color: colors.textSecondary,
    transition: 'color .2s ease',
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} size={56} />
          <div style={{ marginTop: 14, fontSize: 22, fontWeight: 700, color: colors.text }}>
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>
            {mode === 'login' ? '登录以继续使用你的工作空间' : '注册后即可登录你的工作空间'}
          </div>
        </div>

        {/* 内切 tab：登录 / 注册（带动画指示器） */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            marginBottom: 24,
            padding: 4,
            borderRadius: 999,
            background: colors.surface ?? 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: 'calc(50% - 4px)',
              borderRadius: 999,
              background: colors.primary,
              transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)',
              transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            }}
          />
          <button
            type="button"
            onClick={() => switchMode('login')}
            style={{ ...tabBtnStyle, color: mode === 'login' ? '#fff' : colors.textSecondary }}
          >
            登 录
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            style={{ ...tabBtnStyle, color: mode === 'register' ? '#fff' : colors.textSecondary }}
          >
            注 册
          </button>
        </div>

        {pendingAutoLogin && countdown > 0 ? (
          /* 注册成功 → 倒计时自动登录 */
          <div
            key="success"
            className="vc-tab-pane"
            style={{ textAlign: 'center', padding: '20px 0 8px' }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
              注册成功，正在自动登录…
            </div>
            <div style={{ marginTop: 10, fontSize: 30, fontWeight: 700, color: colors.primary }}>
              {countdown}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>
              无需操作，{countdown} 秒后将自动进入工作空间
            </div>
          </div>
        ) : (
          <div key={mode} className="vc-tab-pane">
            {mode === 'login' ? (
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
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={loading}
                  onClick={onLogin}
                  style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}
                >
                  登 录
                </Button>
              </Form>
            ) : (
              <Form layout="vertical" onFinish={onRegister}>
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
                <Form.Item label="昵称（可选）" style={{ marginBottom: 16 }}>
                  <Input
                    size="large"
                    placeholder="昵称，留空默认用用户名"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="密码" style={{ marginBottom: 16 }}>
                  <Input.Password
                    size="large"
                    placeholder="至少 6 位"
                    prefix={<Icon icon={lockIcon} width={16} />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="确认密码" style={{ marginBottom: 24 }}>
                  <Input.Password
                    size="large"
                    placeholder="再次输入密码"
                    prefix={<Icon icon={lockIcon} width={16} />}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onPressEnter={onRegister}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={registering}
                  onClick={onRegister}
                  style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}
                >
                  注册并登录
                </Button>
              </Form>
            )}
          </div>
        )}

        {/* 运行模式开关：本地绕过 / 真实后端联调 */}
        <Divider style={{ margin: '20px 0 14px', fontSize: 12, color: colors.textSecondary }}>运行模式</Divider>
        <Radio.Group
          value={bypassMode ? 'bypass' : 'real'}
          onChange={onModeChange}
          size="small"
          style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}
        >
          <Radio value="bypass" style={{ color: colors.text }}>
            本地绕过演示
            <span style={{ marginLeft: 6, fontSize: 11, color: colors.textSecondary }}>
              （默认，不连后端，开箱即用）
            </span>
          </Radio>
          <Radio value="real" style={{ color: colors.text }}>
            真实后端联调
            <span style={{ marginLeft: 6, fontSize: 11, color: colors.textSecondary }}>
              （后端部署后切换）
            </span>
          </Radio>
        </Radio.Group>
        {!bypassMode && (
          <div style={{ marginTop: 8 }}>
            <Input
              size="small"
              placeholder="后端地址，如 http://1.2.3.4:8123/api"
              value={apiBaseInput}
              onChange={(e) => setApiBaseInput(e.target.value)}
              onBlur={onApiBaseBlur}
              style={{ fontSize: 12 }}
            />
            <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary }}>
              联调用真实账号登录（如 admin / admin123）
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
