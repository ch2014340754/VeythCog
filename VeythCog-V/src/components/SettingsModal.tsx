import React, { useState } from 'react';
import { Modal } from 'antd';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import cpuIcon from '@iconify-icons/lucide/cpu';
import birdIcon from '@iconify-icons/lucide/bird';
import paletteIcon from '@iconify-icons/lucide/palette';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import AccountSettings from '@/pages/Settings/Account';
import ProvidersSettings from '@/pages/Settings/Providers';
import LarkBindSettings from '@/pages/Settings/LarkBind';
import AppearanceSettings from '@/pages/Settings/Appearance';

export type SettingsTab = 'account' | 'providers' | 'lark' | 'appearance';

const MENU: { key: SettingsTab; icon: typeof userIcon; label: string }[] = [
  { key: 'account', icon: userIcon, label: '账号' },
  { key: 'providers', icon: cpuIcon, label: '模型配置' },
  { key: 'lark', icon: birdIcon, label: '飞书绑定' },
  { key: 'appearance', icon: paletteIcon, label: '外观' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** 打开时默认显示的 tab */
  defaultTab?: SettingsTab;
}

/**
 * 设置弹窗：从用户菜单触发，在当前页弹出，不跳转路由
 * 便于边切主题/毛玻璃边对比效果
 */
const SettingsModal: React.FC<Props> = ({ open, onClose, defaultTab = 'account' }) => {
  const { colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const [tab, setTab] = useState<SettingsTab>(defaultTab);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      styles={{
        content: {
          padding: 0,
          borderRadius: 16,
          overflow: 'hidden',
        },
        body: {
          padding: 0,
          height: '78vh',
          minHeight: 520,
        },
      }}
      closable={false}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        {/* 左侧菜单 */}
        <aside
          style={{
            width: 180,
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
          {MENU.map((item) => {
            const active = tab === item.key;
            return (
              <div
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  marginBottom: 2,
                  fontSize: 14,
                  color: active ? colors.primary : colors.textSecondary,
                  background: active ? colors.primary10 : 'transparent',
                  transition: `all 0.2s var(--spring)`,
                  backdropFilter: active && glassEnabled ? 'blur(8px) saturate(160%)' : undefined,
                  WebkitBackdropFilter: active && glassEnabled ? 'blur(8px) saturate(160%)' : undefined,
                }}
              >
                <Icon icon={item.icon} width={16} />
                {item.label}
              </div>
            );
          })}
        </aside>

        {/* 右侧内容 */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {tab === 'account' && <AccountSettings />}
          {tab === 'providers' && <ProvidersSettings />}
          {tab === 'lark' && <LarkBindSettings />}
          {tab === 'appearance' && <AppearanceSettings />}
        </main>
      </div>
    </Modal>
  );
};

export default SettingsModal;
