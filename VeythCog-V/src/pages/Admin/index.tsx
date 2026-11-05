import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';
import usersIcon from '@iconify-icons/lucide/users';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import brainIcon from '@iconify-icons/lucide/brain';
import monitorIcon from '@iconify-icons/lucide/activity';
import listIcon from '@iconify-icons/lucide/list-checks';
import settingsIcon from '@iconify-icons/lucide/settings-2';
import clockIcon from '@iconify-icons/lucide/clock';
import { useTheme } from '@/contexts/ThemeContext';

const MENU = [
  { path: '/admin/users', icon: usersIcon, label: '用户管理' },
  { path: '/admin/roles', icon: shieldIcon, label: '角色管理' },
  { path: '/admin/models', icon: brainIcon, label: '模型目录' },
  { path: '/admin/monitor', icon: monitorIcon, label: '系统监控' },
  { path: '/admin/audit', icon: listIcon, label: '审计日志' },
  { path: '/admin/tasks', icon: clockIcon, label: '定时任务' },
  { path: '/admin/config', icon: settingsIcon, label: '系统配置' },
] as const;

const AdminPage: React.FC = () => {
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
          系统管理
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
        <Outlet />
      </main>
    </div>
  );
};

export default AdminPage;
