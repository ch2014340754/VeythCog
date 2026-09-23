import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface ToolShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** 顶部额外操作区 */
  actions?: React.ReactNode;
  /** 内容区是否撑满高度（输入输出类工具用 true，纯表单类用 false） */
  fillHeight?: boolean;
}

/**
 * 工具页统一壳子：标题 + 描述 + 内容区
 * fillHeight=true 时内容区撑满剩余高度，适合输入输出类工具
 */
const ToolShell: React.FC<ToolShellProps> = ({ title, description, children, actions, fillHeight = false }) => {
  const { colors } = useTheme();
  return (
    <div
      style={{
        padding: '16px 24px',
        height: fillHeight ? '100%' : 'auto',
        display: fillHeight ? 'flex' : 'block',
        flexDirection: fillHeight ? 'column' : undefined,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{title}</h1>
          {description && (
            <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>{description}</p>
          )}
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
      <div style={fillHeight ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}>
        {children}
      </div>
    </div>
  );
};

export default ToolShell;
