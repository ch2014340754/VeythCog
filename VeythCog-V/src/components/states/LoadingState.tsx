/**
 * 加载状态组件：与全站 .vc-state 视觉一致
 */
import React from 'react';
import { Spin } from 'antd';

interface Props {
  tip?: string;
  /** 占满父容器高度 */
  full?: boolean;
}

const LoadingState: React.FC<Props> = ({ tip = '加载中…', full = true }) => (
  <div className={full ? 'vc-state vc-state--fill' : 'vc-state'}>
    <Spin size="default" />
    <div className="vc-state__desc">{tip}</div>
  </div>
);

export default LoadingState;
