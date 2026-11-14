import React, { useState } from 'react';
import { Input } from 'antd';
import { diffLines } from 'diff';
import ToolShell from '../ToolShell';

const TextDiff: React.FC = () => {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');

  const parts = diffLines(left, right);

  const pane = (value: string, onChange: (v: string) => void, label: string, placeholder: string) => (
    <div className="vc-tool-pane">
      <div className="vc-tool-pane__head">
        <span className="vc-tool-pane__label">{label}</span>
        <div className="vc-tool-pane__side">
          <span className="vc-meta">{value.length.toLocaleString()} 字符</span>
        </div>
      </div>
      <div className="vc-tool-pane__body">
        <Input.TextArea
          className="vc-mono-input"
          variant="borderless"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  return (
    <ToolShell title="文本 Diff" description="左右双栏对比，红绿标增删" fillHeight>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', height: 150, flexShrink: 0 }}>
          {pane(left, setLeft, '原始文本', '粘贴原始文本')}
          {pane(right, setRight, '新文本', '粘贴新文本')}
        </div>

        <div className="vc-tool-pane" style={{ flex: 1, minHeight: 0 }}>
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">差异结果</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">
                +{parts.filter((p) => p.added).length} / −{parts.filter((p) => p.removed).length} 块
              </span>
            </div>
          </div>
          <div
            className="vc-tool-pane__body"
            style={{ overflow: 'auto', display: 'block', fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13, lineHeight: 1.6 }}
          >
            {parts.map((part, i) => (
              <div key={i} className={`vc-diff-line${part.added ? ' is-add' : part.removed ? ' is-del' : ''}`}>
                {part.added ? '+ ' : part.removed ? '- ' : '  '}
                {part.value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default TextDiff;
