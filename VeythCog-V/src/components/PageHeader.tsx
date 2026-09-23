/**
 * 页面头部：标题 + 描述 + 右侧操作区
 */
import React from 'react';

interface Props {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

const PageHeader: React.FC<Props> = ({ title, description, extra }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{title}</h2>
      {description && <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-text-secondary)' }}>{description}</div>}
    </div>
    {extra && <div style={{ display: 'flex', gap: 8 }}>{extra}</div>}
  </div>
);

export default PageHeader;
