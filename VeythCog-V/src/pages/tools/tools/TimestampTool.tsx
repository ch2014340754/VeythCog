import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const TimestampTool: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  const parse = (): { date: Date; ms: number } | null => {
    const v = input.trim();
    if (!v) return null;
    const num = Number(v);
    if (Number.isNaN(num)) return null;
    // 10 位秒级 / 13 位毫秒级
    const ms = num < 1e12 ? num * 1000 : num;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return null;
    return { date, ms };
  };

  const result = parse();

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    message.success('已复制');
  };

  return (
    <ToolShell title="Unix 时间戳转换" description="支持秒级（10 位）和毫秒级（13 位）">
      <div style={{ marginBottom: 16, padding: 12, background: colors.primary10, borderRadius: 'var(--radius-md)' }}>
        <span style={{ color: colors.textSecondary, fontSize: 12 }}>当前时间戳：</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: colors.primary }}>{now}</span>
        <span style={{ color: colors.textTertiary, margin: '0 8px' }}>|</span>
        <button onClick={() => copy(String(now))} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: 12 }}>复制秒级</button>
        <span style={{ color: colors.textTertiary, margin: '0 8px' }}>|</span>
        <button onClick={() => copy(String(now * 1000))} style={{ border: 'none', background: 'transparent', color: colors.primary, cursor: 'pointer', fontSize: 12 }}>复制毫秒</button>
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入时间戳，如 1700000000 或 1700000000000"
        style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", marginBottom: 16 }}
      />
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: '本地时间', value: result.date.toLocaleString('zh-CN') },
            { label: 'UTC', value: result.date.toUTCString() },
            { label: 'ISO', value: result.date.toISOString() },
            { label: '秒级', value: String(Math.floor(result.ms / 1000)) },
            { label: '毫秒级', value: String(result.ms) },
            { label: '相对', value: new Date(result.ms).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) },
          ].map((r) => (
            <div
              key={r.label}
              style={{
                padding: 12,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: 11, color: colors.textTertiary }}>{r.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13, marginTop: 2 }}>{r.value}</div>
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
};

export default TimestampTool;
