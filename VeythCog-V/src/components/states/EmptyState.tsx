/**
 * 空状态组件
 */
import React from 'react';
import { Empty } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  description?: string;
  children?: React.ReactNode;
}

const EmptyState: React.FC<Props> = ({ description = '暂无数据', children }) => {
  const { colors } = useTheme();
  return (
    <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Empty description={<span style={{ color: colors.textSecondary }}>{description}</span>} />
      {children}
    </div>
  );
};

export default EmptyState;
