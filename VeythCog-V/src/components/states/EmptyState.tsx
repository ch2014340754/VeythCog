/**
 * 空状态组件：与全站 .vc-state 视觉一致
 */
import React from 'react';
import { Icon } from '@iconify/react';
import inboxIcon from '@iconify-icons/lucide/inbox';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  /** 可选主标题（14/600），不传时只显示描述 */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** 可选图标，默认收件箱 */
  icon?: typeof inboxIcon;
  /** 可选补充操作（按钮等） */
  children?: React.ReactNode;
}

const EmptyState: React.FC<Props> = ({ title, description = '暂无数据', icon = inboxIcon, children }) => {
  const { colors } = useTheme();
  return (
    <div className="vc-state">
      <div className="vc-state__icon">
        <Icon icon={icon} width={24} style={{ color: colors.primary }} />
      </div>
      {title && <div className="vc-state__title">{title}</div>}
      <div className="vc-state__desc">{description}</div>
      {children}
    </div>
  );
};

export default EmptyState;
