import React, { useMemo, useState } from 'react';
import { Input, Button, message } from 'antd';
import ToolShell from '../ToolShell';

const WordCount: React.FC = () => {
  const [text, setText] = useState('');
  const [deduped, setDeduped] = useState('');

  const stats = useMemo(() => {
    const chars = text.length;
    const noSpace = text.replace(/\s/g, '').length;
    const lines = text ? text.split('\n').length : 0;
    const words = (text.match(/[a-zA-Z0-9]+/g) || []).length;
    const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    return { chars, noSpace, lines, words, cjk };
  }, [text]);

  const dedupLines = () => {
    const lines = text.split('\n');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of lines) {
      if (!seen.has(l)) {
        seen.add(l);
        out.push(l);
      }
    }
    setDeduped(out.join('\n'));
    message.success(`从 ${lines.length} 行去重到 ${out.length} 行`);
  };

  const statCards: { label: string; value: number }[] = [
    { label: '总字符', value: stats.chars },
    { label: '不含空格', value: stats.noSpace },
    { label: '行数', value: stats.lines },
    { label: '英文单词', value: stats.words },
    { label: '中文字', value: stats.cjk },
  ];

  return (
    <ToolShell
      title="字数统计 / 文本去重"
      description="实时统计字符数、行数、中英文数；按行去重"
      fillHeight
      actions={
        <Button onClick={dedupLines} disabled={!text.trim()}>
          按行去重
        </Button>
      }
    >
      <div className="vc-grid vc-grid--stats" style={{ flexShrink: 0, marginBottom: 'var(--space-md)' }}>
        {statCards.map((s) => (
          <div key={s.label} className="vc-card vc-stat">
            <div className="vc-stat__value">{s.value.toLocaleString()}</div>
            <div className="vc-stat__label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="vc-tool-split">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输入文本</span>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="粘贴文本"
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">去重结果</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{deduped ? `${deduped.split('\n').length} 行` : '等待去重'}</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={deduped}
              readOnly
              placeholder="点右上角「按行去重」生成结果"
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default WordCount;
