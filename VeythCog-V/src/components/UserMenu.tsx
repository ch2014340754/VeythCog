import SettingsModal, { type SettingsTab } from '@/components/SettingsModal';
import { useAuthStore } from '@/stores/authStore';
import birdIcon from '@iconify-icons/lucide/bird';
import logInIcon from '@iconify-icons/lucide/log-in';
import logOutIcon from '@iconify-icons/lucide/log-out';
import paletteIcon from '@iconify-icons/lucide/palette';
import settingsIcon from '@iconify-icons/lucide/settings';
import userIcon from '@iconify-icons/lucide/user';
import { Icon } from '@iconify/react';
import { message, Popover } from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UserMenu: React.FC = () => {
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
      className={
        'vc-avatar' +
        (size >= 40 ? ' vc-avatar--lg' : '') +
        (loggedIn ? ' vc-avatar--on' : '') +
        (ring ? ' vc-avatar--ring' : '')
      }
    >
      {loggedIn && avatarUrl && !avatarBroken ? (
        <img src={avatarUrl} alt={user!.name} onError={() => setAvatarBroken(true)} />
      ) : loggedIn ? (
        initial
      ) : (
        <Icon icon={userIcon} width={18} />
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
    <button type="button" className="vc-usermenu__item" onClick={onClick}>
      <Icon icon={icon} width={17} />
      <span className="vc-usermenu__label">{label}</span>
      {right}
    </button>
  );

  const content = (
    <div className="vc-usermenu">
      {/* 顶部用户信息 */}
      <div className="vc-usermenu__head">
        {renderAvatar(40, false)}
        <div className="vc-usermenu__who">
          <div className="vc-usermenu__name">{loggedIn ? user!.name : '未登录'}</div>
          <div className="vc-usermenu__sub">
            {loggedIn ? user!.email ?? '本地账号' : '点击登录以同步配置'}
          </div>
        </div>
      </div>

      <div className="vc-usermenu__divider" />

      {loggedIn && (
        <>
          {menuItem(settingsIcon, '账号设置', () => openSettings('account'))}
          {menuItem(paletteIcon, '外观主题', () => openSettings('appearance'))}
          {menuItem(
            birdIcon,
            '飞书绑定',
            () => openSettings('lark'),
            <span
              className={'vc-usermenu__dot' + (lark.bound ? ' is-on' : '')}
              title={lark.bound ? '已绑定' : '未绑定'}
            />,
          )}
          <div className="vc-usermenu__divider" />
          {menuItem(logOutIcon, '退出登录', () => {
            setOpen(false);
            logout();
            message.success('已退出登录');
            navigate('/login');
          })}
        </>
      )}

      {!loggedIn &&
        menuItem(logInIcon, '登录', () => {
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
        overlayClassName="vc-popover"
      >
        <button
          type="button"
          className="vc-avatar-btn"
          title={loggedIn ? user!.name : '未登录'}
          aria-label="账号菜单"
        >
          {renderAvatar(40, true)}
        </button>
      </Popover>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} defaultTab={settingsTab} />
    </>
  );
};

export default UserMenu;
