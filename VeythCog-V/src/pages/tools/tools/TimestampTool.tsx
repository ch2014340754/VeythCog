import React, { useState } from 'react';
import { Input, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import ToolShell from '../ToolShell';

const TimestampTool: React.FC = () => {
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

  const rows = result
    ? [
        { label: '本地时间', value: result.date.toLocaleString('zh-CN') },
        { label: 'UTC', value: result.date.toUTCString() },
        { label: 'ISO', value: result.date.toISOString() },
        { label: '秒级', value: String(Math.floor(result.ms / 1000)) },
        { label: '毫秒级', value: String(result.ms) },
        {
          label: '日期',
          value: new Date(result.ms).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          }),
        },
      ]
    : [];

  return (
    <ToolShell title="Unix 时间戳转换" description="支持秒级（10 位）和毫秒级（13 位）">
      <div className="vc-panel" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="vc-panel__head">
          <div>
            <h2 className="vc-panel__title">当前时间戳</h2>
            <p className="vc-panel__desc">秒级与毫秒级都从这里取。</p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="vc-icon-btn" onClick={() => copy(String(now))}>
              <Icon icon={copyIcon} width={13} /> 复制秒级
            </button>
            <button className="vc-icon-btn" onClick={() => copy(String(now * 1000))}>
              <Icon icon={copyIcon} width={13} /> 复制毫秒
            </button>
          </div>
        </div>
        <div className="vc-clock-value">{now}</div>
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div className="vc-field-label">时间戳</div>
        <Input
          className="vc-mono-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入时间戳，如 1700000000 或 1700000000000"
        />
      </div>

      {result ? (
        <div className="vc-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {rows.map((r) => (
            <div key={r.label} className="vc-card">
              <div className="vc-result-card__label">{r.label}</div>
              <div className="vc-result-card__value">{r.value}</div>
              <div className="vc-result-card__foot">
                <button className="vc-icon-btn" onClick={() => copy(r.value)}>
                  <Icon icon={copyIcon} width={12} /> 复制
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="vc-meta">输入时间戳后自动换算。</div>
      )}
    </ToolShell>
  );
};

export default TimestampTool;
