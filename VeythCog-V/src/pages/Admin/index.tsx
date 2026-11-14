import React from 'react';
import usersIcon from '@iconify-icons/lucide/users';
import shieldIcon from '@iconify-icons/lucide/shield-check';
import brainIcon from '@iconify-icons/lucide/brain';
import monitorIcon from '@iconify-icons/lucide/activity';
import listIcon from '@iconify-icons/lucide/list-checks';
import settingsIcon from '@iconify-icons/lucide/settings-2';
import clockIcon from '@iconify-icons/lucide/clock';
import { SubPageLayout } from '@/components/SectionNav';

const MENU = [
  { path: '/admin/users', icon: usersIcon, label: '用户管理' },
  { path: '/admin/roles', icon: shieldIcon, label: '角色管理' },
  { path: '/admin/models', icon: brainIcon, label: '模型目录' },
  { path: '/admin/monitor', icon: monitorIcon, label: '系统监控' },
  { path: '/admin/audit', icon: listIcon, label: '审计日志' },
  { path: '/admin/tasks', icon: clockIcon, label: '定时任务' },
  { path: '/admin/config', icon: settingsIcon, label: '系统配置' },
];

const AdminPage: React.FC = () => (
  <SubPageLayout
    eyebrow="Admin"
    title="系统管理"
    wide
    items={MENU}
    foot="仅管理员可见。所有变更会记录到审计日志。"
  />
);

export default AdminPage;
