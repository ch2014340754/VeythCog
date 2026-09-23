import React, { useState } from 'react';
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

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();
  const loggedIn = !!user;

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
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: loggedIn ? colors.primary : colors.divider,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {loggedIn ? initial : <Icon icon={userIcon} width={18} color={colors.textSecondary} />}
        </div>
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
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: loggedIn ? colors.primary : colors.divider,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 15,
            flexShrink: 0,
            transition: `all 0.2s var(--spring)`,
            boxShadow: loggedIn ? `0 0 0 3px ${colors.primary15}` : 'none',
          }}
          title={loggedIn ? user!.name : '未登录'}
        >
          {loggedIn ? initial : <Icon icon={userIcon} width={18} color={colors.textSecondary} />}
        </div>
      </Popover>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} defaultTab={settingsTab} />
    </>
  );
};

export default UserMenu;
