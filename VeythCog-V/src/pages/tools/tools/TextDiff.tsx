import React, { useState } from 'react';
import { Input } from 'antd';
import { diffLines } from 'diff';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const TextDiff: React.FC = () => {
  const { colors } = useTheme();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');

  const parts = diffLines(left, right);

  return (
    <ToolShell title="文本 Diff" description="左右双栏对比，红绿标增删" fillHeight>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flexShrink: 0 }}>
          <Input.TextArea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="左侧文本（原始）"
            style={{ height: 120, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
          />
          <Input.TextArea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="右侧文本（新）"
            style={{ height: 120, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
          />
        </div>
        <div
          style={{
            flex: 1,
            padding: 12,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 'var(--radius-md)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
          }}
        >
          {parts.map((part, i) => (
            <div
              key={i}
              style={{
                background: part.added
                  ? 'rgba(16,185,129,0.12)'
                  : part.removed
                    ? 'rgba(239,68,68,0.12)'
                    : 'transparent',
                color: part.added ? '#065f46' : part.removed ? '#991b1b' : colors.text,
                padding: '1px 8px',
                borderRadius: 2,
              }}
            >
              {part.added ? '+ ' : part.removed ? '- ' : '  '}
              {part.value}
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
};

export default TextDiff;
