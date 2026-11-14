import React from 'react';
import userIcon from '@iconify-icons/lucide/user';
import cpuIcon from '@iconify-icons/lucide/cpu';
import birdIcon from '@iconify-icons/lucide/bird';
import paletteIcon from '@iconify-icons/lucide/palette';
import { SubPageLayout } from '@/components/SectionNav';

const MENU = [
  { path: '/settings/account', icon: userIcon, label: '账号' },
  { path: '/settings/providers', icon: cpuIcon, label: '模型配置' },
  { path: '/settings/lark', icon: birdIcon, label: '飞书绑定' },
  { path: '/settings/appearance', icon: paletteIcon, label: '外观' },
];

const SettingsPage: React.FC = () => (
  <SubPageLayout
    eyebrow="Settings"
    title="设置"
    items={MENU}
    backTo="/home"
    foot="主题与壁纸在「外观」中统一管理，全站页面同步生效。"
  />
);

export default SettingsPage;
