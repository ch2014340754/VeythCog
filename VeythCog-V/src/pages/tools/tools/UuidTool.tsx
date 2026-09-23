import React, { useState } from 'react';
import { Input, Button, Slider, message } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const UuidTool: React.FC = () => {
  const { colors } = useTheme();
  const [count, setCount] = useState(10);
  const [uuids, setUuids] = useState<string[]>([]);

  const gen = () => {
    const arr = Array.from({ length: count }, () => crypto.randomUUID());
    setUuids(arr);
  };

  return (
    <ToolShell title="UUID 生成" description="批量生成 v4 UUID"
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>数量</span>
          <Slider min={1} max={100} value={count} onChange={setCount} style={{ width: 100 }} />
          <Button size="small" type="primary" onClick={gen}>生成</Button>
          <Button size="small" onClick={() => { navigator.clipboard.writeText(uuids.join('\n')); message.success('已复制全部'); }} disabled={!uuids.length}>
            复制全部
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {uuids.map((u, i) => (
          <div
            key={i}
            onClick={() => { navigator.clipboard.writeText(u); message.success('已复制'); }}
            style={{
              padding: '8px 12px',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 'var(--radius-sm)',
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {u}
          </div>
        ))}
      </div>
    </ToolShell>
  );
};

export default UuidTool;
