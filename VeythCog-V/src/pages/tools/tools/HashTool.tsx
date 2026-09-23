import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const HashTool: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const sha = async (algo: string, data: string): Promise<string> => {
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const run = async () => {
    if (!input) return;
    setLoading(true);
    try {
      const [md5, sha1, sha256, sha512] = await Promise.all([
        import('crypto-js/md5').then((m) => m.default(input).toString()),
        sha('SHA-1', input),
        sha('SHA-256', input),
        sha('SHA-512', input),
      ]);
      setResults({ MD5: md5, SHA1: sha1, SHA256: sha256, SHA512: sha512 });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (v: string) => {
    await navigator.clipboard.writeText(v);
    message.success('已复制');
  };

  return (
    <ToolShell title="哈希计算" description="MD5 / SHA1 / SHA256 / SHA512，全部本地计算"
      fillHeight
      actions={<Button size="small" type="primary" onClick={run} loading={loading} disabled={!input}>计算</Button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输入文本</div>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要计算哈希的文本"
            style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'auto' }}>
          {Object.entries(results).map(([algo, val]) => (
            <div
              key={algo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-md)',
                marginTop: 23
              }}
            >
              <div style={{ width: 70, fontWeight: 600, color: colors.primary, flexShrink: 0 }}>{algo}</div>
              <div
                style={{
                  flex: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  wordBreak: 'break-all',
                  color: colors.textSecondary,
                }}
              >
                {val}
              </div>
              <button
                onClick={() => copy(val)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textTertiary, flexShrink: 0 }}
              >
                <Icon icon={copyIcon} width={14} />
              </button>
            </div>
          ))}
          {Object.keys(results).length === 0 && (
            <div style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              输入文本后点"计算"
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
};

export default HashTool;
