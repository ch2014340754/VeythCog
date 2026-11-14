import AppearanceSettings from '@/pages/Settings/Appearance';
import AccountSettings from '@/pages/Settings/Account';
import LarkBindSettings from '@/pages/Settings/LarkBind';
import ProvidersSettings from '@/pages/Settings/Providers';
import birdIcon from '@iconify-icons/lucide/bird';
import cpuIcon from '@iconify-icons/lucide/cpu';
import paletteIcon from '@iconify-icons/lucide/palette';
import userIcon from '@iconify-icons/lucide/user';
import { Icon } from '@iconify/react';
import { Modal } from 'antd';
import React, { useEffect, useState } from 'react';

export type SettingsTab = 'account' | 'providers' | 'lark' | 'appearance';

const MENU: { key: SettingsTab; icon: typeof userIcon; label: string }[] = [
  { key: 'account', icon: userIcon, label: '账号设置' },
  { key: 'providers', icon: cpuIcon, label: '模型配置' },
  { key: 'lark', icon: birdIcon, label: '飞书绑定' },
  { key: 'appearance', icon: paletteIcon, label: '外观设置' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** 打开时默认显示的 tab */
  defaultTab?: SettingsTab;
}

/**
 * 设置弹窗：从用户菜单触发，在当前页弹出，不跳转路由
 * 便于边切主题/毛玻璃边对比效果。
 * 复用设置页的四个面板（同一套组件与主题机制），弹窗内用 .vc-modal-page 收敛页面级标题。
 */
const SettingsModal: React.FC<Props> = ({ open, onClose, defaultTab = 'account' }) => {
  const [tab, setTab] = useState<SettingsTab>(defaultTab);

  // 弹窗关闭时组件仍保留上一次的内部 tab；每次重新打开都必须跟随本次入口的 defaultTab，
  // 否则从「外观主题」进来仍会显示上一次的「账号设置」。
  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      closable={false}
      rootClassName="vc-settings-modal"
      styles={{
        content: {
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        },
        body: {
          padding: 0,
          height: '78vh',
          minHeight: 520,
        },
      }}
    >
      <div className="vc-settings-modal__layout">
        {/* 左侧菜单 */}
        <aside className="vc-settings-modal__nav">
          <div className="vc-settings-modal__title">设置</div>
          {MENU.map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => setTab(item.key)}
              className={'vc-settings-modal__item' + (tab === item.key ? ' is-active' : '')}
            >
              <Icon icon={item.icon} width={16} />
              {item.label}
            </button>
          ))}
        </aside>

        {/* 右侧内容 */}
        <main className="vc-settings-modal__body vc-modal-page">
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
