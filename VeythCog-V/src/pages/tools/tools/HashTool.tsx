import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import ToolShell from '../ToolShell';

const ALGOS = ['MD5', 'SHA1', 'SHA256', 'SHA512'];

const HashTool: React.FC = () => {
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

  const hasResult = Object.keys(results).length > 0;

  return (
    <ToolShell
      title="哈希计算"
      description="MD5 / SHA1 / SHA256 / SHA512，全部本地计算"
      fillHeight
      actions={
        <Button type="primary" onClick={run} loading={loading} disabled={!input}>
          计算
        </Button>
      }
    >
      <div className="vc-tool-split">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输入文本</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{input.length.toLocaleString()} 字符</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入要计算哈希的文本"
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">结果</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{hasResult ? `${ALGOS.length} 种算法` : '等待计算'}</span>
            </div>
          </div>
          <div className="vc-tool-pane__body" style={{ overflow: 'auto', gap: 'var(--space-sm)' }}>
            {hasResult ? (
              Object.entries(results).map(([algo, val]) => (
                <div key={algo} className="vc-hash-row">
                  <span className="vc-hash-row__algo">{algo}</span>
                  <span className="vc-hash-row__value">{val}</span>
                  <button className="vc-icon-btn" onClick={() => copy(val)} title="复制">
                    <Icon icon={copyIcon} width={14} />
                  </button>
                </div>
              ))
            ) : (
              <div className="vc-meta" style={{ padding: 'var(--space-md) 0' }}>
                输入文本后点「计算」
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default HashTool;
