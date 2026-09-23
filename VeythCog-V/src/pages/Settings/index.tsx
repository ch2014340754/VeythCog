import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import cpuIcon from '@iconify-icons/lucide/cpu';
import birdIcon from '@iconify-icons/lucide/bird';
import paletteIcon from '@iconify-icons/lucide/palette';
import { useTheme } from '@/contexts/ThemeContext';

const MENU = [
  { path: '/settings/account', icon: userIcon, label: '账号' },
  { path: '/settings/providers', icon: cpuIcon, label: '模型配置' },
  { path: '/settings/lark', icon: birdIcon, label: '飞书绑定' },
  { path: '/settings/appearance', icon: paletteIcon, label: '外观' },
] as const;

const SettingsPage: React.FC = () => {
  const { colors } = useTheme();

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 左侧菜单 */}
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          padding: '24px 12px',
          borderRight: `1px solid ${colors.divider}`,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: colors.text,
            padding: '0 12px 12px',
            letterSpacing: 0.5,
          }}
        >
          设置
        </div>
        {MENU.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              marginBottom: 2,
              fontSize: 14,
              textDecoration: 'none',
              color: isActive ? colors.primary : colors.textSecondary,
              background: isActive ? colors.primary10 : 'transparent',
              transition: `all 0.2s var(--spring)`,
            })}
          >
            <Icon icon={item.icon} width={16} />
            {item.label}
          </NavLink>
        ))}
      </aside>

      {/* 右侧内容 */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 40px',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
