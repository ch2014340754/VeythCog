import React, { useEffect, useState } from 'react';
import { Popover, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import settingsIcon from '@iconify-icons/lucide/settings';
import paletteIcon from '@iconify-icons/lucide/palette';
import birdIcon from '@iconify-icons/lucide/bird';
import logoutIcon from '@iconify-icons/lucide/log-out';
import loginIcon from '@iconify-icons/lucide/log-in';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import SettingsModal, { type SettingsTab } from '@/components/SettingsModal';

const UserMenu: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { user, lark, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('account');
  const [avatarBroken, setAvatarBroken] = useState(false);

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();
  const loggedIn = !!user;
  const avatarUrl = user?.avatar;

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  /** 头像圆块：有真实头像优先展示，加载失败回退昵称首字母 */
  const renderAvatar = (size: number, ring: boolean) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: loggedIn ? colors.primary : colors.divider,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size >= 40 ? 15 : 16,
        flexShrink: 0,
        overflow: 'hidden',
        transition: `all 0.2s var(--spring)`,
        boxShadow: ring && loggedIn ? `0 0 0 3px ${colors.primary15}` : 'none',
      }}
    >
      {loggedIn && avatarUrl && !avatarBroken ? (
        <img
          src={avatarUrl}
          alt={user!.name}
          onError={() => setAvatarBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : loggedIn ? (
        initial
      ) : (
        <Icon icon={userIcon} width={18} color={colors.textSecondary} />
      )}
    </div>
  );

  /** 打开设置弹窗（在当前页弹出，不跳转） */
  const openSettings = (tab: SettingsTab) => {
    setOpen(false);
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const menuItem = (
    icon: typeof userIcon,
    label: string,
    onClick: () => void,
    right?: React.ReactNode,
  ) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        cursor: 'pointer',
        fontSize: 14,
        color: colors.text,
        transition: `background 0.15s`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = colors.primary10)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon icon={icon} width={17} />
      <span style={{ flex: 1 }}>{label}</span>
      {right}
    </div>
  );

  const content = (
    <div className="glass-panel" style={{ width: 260, padding: '8px 0' }}>
      {/* 顶部用户信息 */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {renderAvatar(40, false)}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {loggedIn ? user!.name : '未登录'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: colors.textTertiary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {loggedIn ? user!.email ?? '本地账号' : '点击登录以同步配置'}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: colors.divider, margin: '4px 0' }} />

      {loggedIn && (
        <>
          {menuItem(settingsIcon, '账号设置', () => openSettings('account'))}
          {menuItem(paletteIcon, '外观主题', () => openSettings('appearance'))}
          {menuItem(
            birdIcon,
            '飞书绑定',
            () => openSettings('lark'),
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: lark.bound ? colors.success : colors.divider,
                display: 'inline-block',
              }}
              title={lark.bound ? '已绑定' : '未绑定'}
            />,
          )}
          <div style={{ height: 1, background: colors.divider, margin: '4px 0' }} />
          {menuItem(logoutIcon, '退出登录', () => {
            setOpen(false);
            logout();
            message.success('已退出登录');
            navigate('/login');
          })}
        </>
      )}

      {!loggedIn &&
        menuItem(loginIcon, '登录', () => {
          setOpen(false);
          navigate('/login');
        })}
    </div>
  );

  return (
    <>
      <Popover
        content={content}
        trigger="click"
        placement="rightTop"
        arrow={false}
        open={open}
        onOpenChange={setOpen}
        overlayStyle={{ borderRadius: 'var(--radius-lg)' }}
      >
        <div
          style={{ cursor: 'pointer', flexShrink: 0 }}
          title={loggedIn ? user!.name : '未登录'}
        >
          {renderAvatar(40, true)}
        </div>
      </Popover>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} defaultTab={settingsTab} />
    </>
  );
};

export default UserMenu;
