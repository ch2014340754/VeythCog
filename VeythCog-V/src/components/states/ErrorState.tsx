/**
 * 错误状态组件（业务错误，非崩溃）
 */
import React from 'react';
import { Button } from 'antd';
import { Icon } from '@iconify/react';
import alertIcon from '@iconify-icons/lucide/alert-circle';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<Props> = ({ title = '加载失败', message, onRetry }) => (
  <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
    <Icon icon={alertIcon} width={32} style={{ color: '#ff4d4f' }} />
    <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
    {message && <div style={{ fontSize: 12, color: '#999' }}>{message}</div>}
    {onRetry && (
      <Button size="small" onClick={onRetry}>
        重试
      </Button>
    )}
  </div>
);

export default ErrorState;
