import React, { useMemo, useState } from 'react';
import { Input, Button, message } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const WordCount: React.FC = () => {
  const { colors } = useTheme();
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
    <ToolShell title="字数统计 / 文本去重" description="实时统计字符数、行数、中英文数；按行去重"
      actions={<Button size="small" onClick={dedupLines} disabled={!text.trim()}>按行去重</Button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {statCards.map((s) => (
          <div
            key={s.label}
            style={{
              padding: 12,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>{s.value}</div>
            <div style={{ fontSize: 11, color: colors.textSecondary }}>{s.label}</div>
          </div>
        ))}
      </div>
      <Input.TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴文本"
        autoSize={{ minRows: 10, maxRows: 18 }}
        style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
      />
      {deduped && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>去重结果</div>
          <Input.TextArea
            value={deduped}
            readOnly
            autoSize={{ minRows: 6, maxRows: 12 }}
            style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
          />
        </div>
      )}
    </ToolShell>
  );
};

export default WordCount;
