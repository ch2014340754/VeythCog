/**
 * 加载状态组件
 */
import React from 'react';
import { Spin } from 'antd';

interface Props {
  tip?: string;
  /** 占满父容器高度 */
  full?: boolean;
}

const LoadingState: React.FC<Props> = ({ tip = '加载中...', full = true }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      ...(full ? { height: '100%', minHeight: 200 } : { padding: 48 }),
    }}
  >
    <Spin />
    <div style={{ fontSize: 12, color: '#999' }}>{tip}</div>
  </div>
);

export default LoadingState;
