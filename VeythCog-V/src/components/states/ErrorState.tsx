/**
 * 错误状态组件（业务错误，非崩溃）：与全站 .vc-state 视觉一致
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
  <div className="vc-state">
    <div className="vc-state__icon vc-state__icon--error">
      <Icon icon={alertIcon} width={24} />
    </div>
    <div className="vc-state__title">{title}</div>
    {message && <div className="vc-state__desc">{message}</div>}
    {onRetry && (
      <Button size="small" onClick={onRetry}>
        重试
      </Button>
    )}
  </div>
);

export default ErrorState;
