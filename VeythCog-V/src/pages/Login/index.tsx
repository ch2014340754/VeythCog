import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, message, Radio } from 'antd';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import lockIcon from '@iconify-icons/lucide/lock';
import chevronDownIcon from '@iconify-icons/lucide/chevron-down';
import messageIcon from '@iconify-icons/lucide/message-square';
import bookIcon from '@iconify-icons/lucide/book-open';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import { useTheme } from '@/contexts/ThemeContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';
import { useModeStore } from '@/stores/modeStore';
import { register as authRegister } from '@/api/auth';
import { MOCK_TOKEN } from '@/config';
import VeythCogLogo from '@/components/VeythCogLogo';
import './login.css';

type Mode = 'login' | 'register';

/**
 * 登录后落地页：优先回跳来源页（RequireAuth 记录），否则回导航首页 /home。
 * 设计口径见 openspec/changes/p1-nav-homepage：/home 是登录后默认落地页，根路径 / 也指向 /home。
 * 来源页为 /login 时视为无效（避免自跳），同样回落 /home。
 */
/**
 * 把主题主色转成 "r, g, b" 三段，方便和任意 alpha 拼成 rgba()。
 * 支持 #rgb / #rrggbb / rgb() / rgba()，解析失败时退回 124, 58, 237。
 */
function toRgbTriplet(color: string): string {
  const value = (color || '').trim();
  const fallback = '124, 58, 237';

  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').slice(0, 3).map((n) => Number.parseFloat(n));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      return parts.map((n) => Math.round(n)).join(', ');
    }
    return fallback;
  }

  const hex = value.replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return hex
      .split('')
      .map((c) => Number.parseInt(c + c, 16))
      .join(', ');
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4]
      .map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      .join(', ');
  }
  return fallback;
}

const resolveLanding = (from?: string | null) =>
  from && from !== '/login' ? from : '/home';

/** 左侧品牌叙事里的三条能力点，与 MainLayout 的 NAV_ITEMS 一一对应 */
const FEATURES = [
  { icon: messageIcon, title: '对话', desc: '多模型流式问答，可引用知识库作答' },
  { icon: bookIcon, title: '知识库', desc: '块编辑器写文档，向量化后参与检索' },
  { icon: wrenchIcon, title: '工具集', desc: 'JSON、编码、哈希、时间等常用小工具' },
];

const LoginPage: React.FC = () => {
  useDocumentTitle('登录');
  const { colors, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, loading, login } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');

  // 登录 / 注册表单（分开实例，避免切换模式时字段与校验互相污染）
  const [loginForm] = Form.useForm<{ username: string; password: string }>();
  const [registerForm] = Form.useForm<{
    username: string;
    nickname?: string;
    password: string;
    confirm: string;
  }>();
  const [registering, setRegistering] = useState(false);

  // 注册成功 → 3 秒倒计时 → 自动登录
  const [pendingAutoLogin, setPendingAutoLogin] = useState<{ username: string; password: string } | null>(null);
  const [countdown, setCountdown] = useState(0);

  // 运行模式：本地绕过 / 真实后端联调（持久化在 modeStore）
  const bypassMode = useModeStore((s) => s.bypassMode);
  const apiBase = useModeStore((s) => s.apiBase);
  const [apiBaseInput, setApiBaseInput] = useState(apiBase);
  const [runModeOpen, setRunModeOpen] = useState(false);

  // 光斑层的指针视差：只写 CSS 变量，真正的位移交给 CSS transform（GPU 合成，不触发重排）
  const auroraRef = React.useRef<HTMLDivElement | null>(null);
  // 卡片描边的方位：指针相对卡片中心的方位角，写进 --lg-angle
  const cardRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = auroraRef.current;
    if (!el) return;
    if (typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const card = cardRef.current;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    // 描边高光：与光斑视差共用一条 rAF，避免两个循环
    let targetDirX = 0;
    let targetDirY = -1;
    let curDirX = 0;
    let curDirY = -1;
    let targetGlow = 0.45;
    let curGlow = 0.45;

    const tick = () => {
      curX += (targetX - curX) * 0.075;
      curY += (targetY - curY) * 0.075;
      el.style.setProperty('--lg-mx', curX.toFixed(4));
      el.style.setProperty('--lg-my', curY.toFixed(4));

      // 指针大幅跳动时直接吸附，避免描边高光绕着卡片「扫」一圈
      if (Math.abs(targetDirX - curDirX) + Math.abs(targetDirY - curDirY) > 1.6) {
        curDirX = targetDirX;
        curDirY = targetDirY;
      } else {
        curDirX += (targetDirX - curDirX) * 0.18;
        curDirY += (targetDirY - curDirY) * 0.18;
      }
      curGlow += (targetGlow - curGlow) * 0.18;

      if (card) {
        // conic-gradient 的 0deg 在正上方、顺时针：用 atan2(dx, -dy) 换算成同向角度
        const angle = (Math.atan2(curDirX, -curDirY) * 180) / Math.PI;
        card.style.setProperty('--lg-angle', `${angle.toFixed(2)}deg`);
        card.style.setProperty('--lg-glow', curGlow.toFixed(3));
      }

      const settled =
        Math.abs(targetX - curX) < 0.001 &&
        Math.abs(targetY - curY) < 0.001 &&
        Math.abs(targetDirX - curDirX) < 0.002 &&
        Math.abs(targetDirY - curDirY) < 0.002 &&
        Math.abs(targetGlow - curGlow) < 0.002;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;

      const box = card?.getBoundingClientRect();
      if (box) {
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height / 2);
        // 横竖用同一个分母，方位角才和指针的真实方向一致（用半宽/半高分别归一化会把角度压歪）
        const unit = box.height / 2;
        targetDirX = dx / unit;
        targetDirY = dy / unit;
        // 越靠近卡片越亮：0.32（远处）~1（贴边/hover）
        const dist = Math.hypot(dx, dy) / unit;
        targetGlow = Math.max(0.32, Math.min(1, 1.18 - dist * 0.42));
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

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

  const onLogin = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      // mock 模式（后端未部署）直接进工具集，避免 /chat 拉后端数据报错
      const mockToken = useAuthStore.getState().token === MOCK_TOKEN;
      const from = mockToken
        ? '/tools'
        : resolveLanding((location.state as { from?: string } | null)?.from);
      navigate(from, { replace: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败');
    }
  };

  const onRegister = async (values: { username: string; nickname?: string; password: string }) => {
    setRegistering(true);
    try {
      await authRegister({ username: values.username, password: values.password, nickname: values.nickname });
      setRegistering(false);
      // 注册成功 → 3 秒后自动登录
      setPendingAutoLogin({ username: values.username.trim(), password: values.password });
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
      navigate(t === MOCK_TOKEN ? '/tools' : '/home', { replace: true });
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
        : resolveLanding((location.state as { from?: string } | null)?.from);
    return <Navigate to={from} replace />;
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setPendingAutoLogin(null);
    setCountdown(0);
  };

  // 主色转 rgb 三元组，供 rgba(...) 拼装发光色（preset 可能是 #rgb / #rrggbb / rgb()）
  // 注意：这里在 hooks 之后（早期 return 之下），所以不能用 useMemo
  const primaryRgb = toRgbTriplet(colors.primary);

  /**
   * 玻璃材质依赖环境色：把主题色以 CSS 变量下发，
   * login.css 只消费变量，不硬编码颜色（6 套 preset / 亮暗色自动适配）。
   */
  const cssVars = {
    '--lg-primary': colors.primary,
    '--lg-primary-10': colors.primary10,
    '--lg-primary-40': colors.primary40,
    '--lg-accent': colors.accent,
    '--lg-cta': colors.cta,
    '--lg-secondary': colors.secondary,
    '--lg-text': colors.text,
    '--lg-text-2': colors.textSecondary,
    '--lg-text-3': colors.textTertiary,
    '--lg-divider': colors.divider,
    '--lg-grid-line': isDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(124, 58, 237, 0.09)',
    '--lg-card-top-light': isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
    '--lg-card-bg': isDark
      ? 'linear-gradient(158deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 46%, rgba(255,255,255,0.06) 100%)'
      : 'linear-gradient(158deg, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0.26) 46%, rgba(255,255,255,0.4) 100%)',
    '--lg-card-border': isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)',
    '--lg-card-shadow': isDark
      ? '0 44px 100px -48px rgba(0,0,0,0.9), 0 12px 32px -20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 46px 92px -34px rgba(76,29,149,0.42), 0 14px 30px -18px rgba(76,29,149,0.24), 0 0 0 1px rgba(255,255,255,0.55), inset 0 0 0 1px rgba(255,255,255,0.5), inset 0 -26px 48px -46px rgba(76,29,149,0.28)',
    '--lg-field-bg': isDark ? '#2E2952' : 'rgba(255,255,255,0.72)',
    '--lg-field-bg-focus': isDark ? '#373064' : 'rgba(255,255,255,0.97)',
    '--lg-field-autofill': isDark ? '#2E2952' : '#F8F5FE',
    '--lg-field-border': isDark ? 'rgba(255,255,255,0.16)' : 'rgba(124,58,237,0.18)',
    '--lg-seg-bg': isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.46)',
    '--lg-chip-bg': isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.58)',
    '--lg-chip-border': isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.86)',
    // 描边发光：主色低透明 + 白色高光芯，跟着 --lg-angle 转
    // 亮色卡边本身接近纯白，白色高光会「消失」，所以亮色只用主色深浅两档；
    // 暗色卡身是饱和蓝紫，留一点白色高光芯才像「在发光」
    '--lg-glow-1': `rgba(${primaryRgb}, 0.42)`,
    '--lg-glow-2': isDark ? 'rgba(255,255,255,0.95)' : `rgba(${primaryRgb}, 0.98)`,
    '--lg-card-glow': isDark
      ? `0 0 84px -22px rgba(${primaryRgb}, 0.62)`
      : `0 0 76px -20px rgba(${primaryRgb}, 0.5)`,
  } as React.CSSProperties;

  return (
    <div className="vc-login" style={cssVars}>
      {/* 场景层：光晕 / 网格 / 噪点 / 暗角 */}
      <div className="vc-login__scene" aria-hidden>
        <div className="vc-login__core" />
        <div className="vc-login__orbit">
          <div className="vc-login__aurora" ref={auroraRef}>
            <span className="vc-login__blob vc-login__blob--a" />
            <span className="vc-login__blob vc-login__blob--b" />
            <span className="vc-login__blob vc-login__blob--c" />
            <span className="vc-login__blob vc-login__blob--d" />
          </div>
        </div>
        <div className="vc-login__grid" />
        <div className="vc-login__noise" />
        <div className="vc-login__vignette" />
      </div>

      <div className="vc-login__inner">
        {/* 左侧：品牌叙事（窄屏隐藏） */}
        <aside className="vc-login__brand">
          <div className="vc-login__wordmark">
            <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} size={38} />
            <div>
              <div className="vc-login__word">渡思</div>
              <div className="vc-login__latin">VeythCog</div>
            </div>
          </div>

          <h1 className="vc-login__headline">
            思考、检索与创造，
            <br />
            收进 <em>同一个工作台</em>。
          </h1>
          <p className="vc-login__lede">
            登录后回到你的空间：对话、知识库、常用工具，都在这里。
          </p>

          <ul className="vc-login__features">
            {FEATURES.map((f) => (
              <li key={f.title} className="vc-login__feature">
                <span className="vc-login__feature-icon">
                  <Icon icon={f.icon} width={16} />
                </span>
                <span>
                  <span className="vc-login__feature-title">{f.title}</span>
                  <span className="vc-login__feature-desc" style={{ display: 'block' }}>
                    {f.desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        {/* 右侧：玻璃登录卡 */}
        <main className="vc-login__card" ref={cardRef}>
          <span className="vc-login__ring vc-login__ring--halo" aria-hidden />
          <span className="vc-login__ring" aria-hidden />

          <div className="vc-login__badge">
            <VeythCogLogo primaryColor={colors.primary} accentColor={colors.accent} size={30} />
          </div>

          <div className="vc-login__title">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </div>
          <div className="vc-login__subtitle">
            {mode === 'login' ? '登录以继续使用你的工作空间' : '注册后即可登录你的工作空间'}
          </div>

          {/* 内切分段控件：登录 / 注册 */}
          <div className="vc-login__seg">
            <span className={`vc-login__seg-thumb${mode === 'register' ? ' is-right' : ''}`} />
            <button
              type="button"
              className="vc-login__seg-btn"
              onClick={() => switchMode('login')}
              style={{ color: mode === 'login' ? (isDark ? '#14102B' : '#fff') : colors.textSecondary }}
            >
              登 录
            </button>
            <button
              type="button"
              className="vc-login__seg-btn"
              onClick={() => switchMode('register')}
              style={{ color: mode === 'register' ? (isDark ? '#14102B' : '#fff') : colors.textSecondary }}
            >
              注 册
            </button>
          </div>

          {pendingAutoLogin && countdown > 0 ? (
            /* 注册成功 → 倒计时自动登录 */
            <div key="success" className="vc-tab-pane vc-login__countdown">
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                注册成功，正在自动登录…
              </div>
              <div className="vc-login__countdown-num">{countdown}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
                无需操作，{countdown} 秒后将自动进入工作空间
              </div>
            </div>
          ) : (
            <div key={mode} className="vc-tab-pane">
              {mode === 'login' ? (
                <Form form={loginForm} layout="vertical" onFinish={onLogin}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, whitespace: true, message: '请输入用户名' }]}
                  >
                    <Input
                      size="large"
                      placeholder="用户名"
                      autoComplete="username"
                      prefix={<Icon icon={userIcon} width={16} />}
                      autoFocus
                    />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                    style={{ marginBottom: 18 }}
                  >
                    <Input.Password
                      size="large"
                      placeholder="密码"
                      autoComplete="current-password"
                      prefix={<Icon icon={lockIcon} width={16} />}
                      onPressEnter={() => loginForm.submit()}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    className="vc-login__submit"
                    loading={loading}
                  >
                    登 录
                  </Button>
                </Form>
              ) : (
                <Form form={registerForm} layout="vertical" onFinish={onRegister}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, whitespace: true, message: '请输入用户名' }]}
                  >
                    <Input
                      size="large"
                      placeholder="用户名"
                      autoComplete="username"
                      prefix={<Icon icon={userIcon} width={16} />}
                      autoFocus
                    />
                  </Form.Item>
                  <Form.Item label="昵称（可选）" name="nickname">
                    <Input size="large" placeholder="昵称，留空默认用用户名" />
                  </Form.Item>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码至少 6 位' },
                    ]}
                  >
                    <Input.Password
                      size="large"
                      placeholder="至少 6 位"
                      autoComplete="new-password"
                      prefix={<Icon icon={lockIcon} width={16} />}
                    />
                  </Form.Item>
                  <Form.Item
                    label="确认密码"
                    name="confirm"
                    dependencies={['password']}
                    style={{ marginBottom: 18 }}
                    rules={[
                      { required: true, message: '请再次输入密码' },
                      ({ getFieldValue }) => ({
                        validator(_rule, value) {
                          if (!value || getFieldValue('password') === value) return Promise.resolve();
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      size="large"
                      placeholder="再次输入密码"
                      autoComplete="new-password"
                      prefix={<Icon icon={lockIcon} width={16} />}
                      onPressEnter={() => registerForm.submit()}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    className="vc-login__submit"
                    loading={registering}
                  >
                    注册并登录
                  </Button>
                </Form>
              )}
            </div>
          )}

          {/* 运行模式（默认收起） */}
          <div className="vc-login__mode">
            <button
              type="button"
              className="vc-login__mode-toggle"
              onClick={() => setRunModeOpen((v) => !v)}
              aria-expanded={runModeOpen}
            >
              <span>运行模式</span>
              <Icon
                icon={chevronDownIcon}
                width={14}
                style={{
                  transition: 'transform .2s ease',
                  transform: runModeOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {runModeOpen && (
              <div className="vc-login__mode-body">
                <Radio.Group
                  value={bypassMode ? 'bypass' : 'real'}
                  onChange={onModeChange}
                  size="small"
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}
                >
                  <Radio value="real" style={{ color: colors.text }}>
                    正常登录（真实后端）
                    <span style={{ marginLeft: 6, fontSize: 11, color: colors.textSecondary }}>默认</span>
                  </Radio>
                  <Radio value="bypass" style={{ color: colors.text }}>
                    本地绕过（mock，不连后端）
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
                    <div className="vc-login__mode-hint">使用真实账号登录（如 admin / admin123）</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LoginPage;
