import React, { useState } from 'react';
import { Button, Slider, Switch, message } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()_+-=[]{};:,.<>?',
};

function genPassword(length: number, opts: { upper: boolean; digit: boolean; symbol: boolean }): string {
  let pool = CHARSETS.lower;
  if (opts.upper) pool += CHARSETS.upper;
  if (opts.digit) pool += CHARSETS.digit;
  if (opts.symbol) pool += CHARSETS.symbol;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((n) => pool[n % pool.length]).join('');
}

const PasswordTool: React.FC = () => {
  const { colors } = useTheme();
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [digit, setDigit] = useState(true);
  const [symbol, setSymbol] = useState(true);
  const [pwd, setPwd] = useState('');

  const regenerate = () => setPwd(genPassword(length, { upper, digit, symbol }));

  return (
    <ToolShell title="密码生成器" description="密码学安全随机数（crypto.getRandomValues）"
      actions={<Button size="small" type="primary" onClick={regenerate}>生成</Button>}
    >
      <div
        style={{
          padding: 20,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 'var(--radius-lg)',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            fontSize: 20,
            wordBreak: 'break-all',
            marginBottom: 12,
            minHeight: 30,
          }}
        >
          {pwd || '点击"生成"'}
        </div>
        {pwd && (
          <Button size="small" onClick={() => { navigator.clipboard.writeText(pwd); message.success('已复制'); }}>
            复制
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>长度</span>
          <Slider min={4} max={64} value={length} onChange={setLength} style={{ width: 150 }} />
          <span style={{ fontFamily: 'monospace', color: colors.primary }}>{length}</span>
        </div>
        <Switch checked={upper} onChange={setUpper} checkedChildren="大写" unCheckedChildren="大写" />
        <Switch checked={digit} onChange={setDigit} checkedChildren="数字" unCheckedChildren="数字" />
        <Switch checked={symbol} onChange={setSymbol} checkedChildren="符号" unCheckedChildren="符号" />
      </div>
    </ToolShell>
  );
};

export default PasswordTool;
