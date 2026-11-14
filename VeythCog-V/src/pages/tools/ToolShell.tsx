import React from 'react';
import PageHeader from '@/components/PageHeader';

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
 * 工具页统一壳子：标准页头 + 内容区
 * fillHeight=true 时内容区撑满剩余高度，适合输入输出类工具
 */
const ToolShell: React.FC<ToolShellProps> = ({ title, description, children, actions, fillHeight = false }) => (
  <div className="vc-page">
    <div
      className="vc-page__body vc-page__body--wide"
      style={fillHeight ? { height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: 24 } : undefined}
    >
      <PageHeader title={title} description={description} extra={actions} />
      <div style={fillHeight ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}>
        {children}
      </div>
    </div>
  </div>
);

export default ToolShell;
