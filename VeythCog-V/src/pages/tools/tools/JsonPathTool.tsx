import React, { useState } from 'react';
import { Input, Button } from 'antd';
import ToolShell from '../ToolShell';
import JsonHighlight from '../components/JsonHighlight';
import { useTheme } from '@/contexts/ThemeContext';

function evalPath(obj: any, path: string): any {
  if (!path) return obj;
  let p = path.trim();
  if (p.startsWith('$')) p = p.slice(1);
  if (p.startsWith('.')) p = p.slice(1);
  const parts = p.match(/[^.[\]]+|\[\d+\]/g) || [];
  let cur = obj;
  for (const part of parts) {
    if (/^\[\d+\]$/.test(part)) {
      const idx = Number(part.slice(1, -1));
      cur = cur?.[idx];
    } else {
      cur = cur?.[part];
    }
    if (cur === undefined) return undefined;
  }
  return cur;
}

const JsonPathTool: React.FC = () => {
  const { colors } = useTheme();
  const [json, setJson] = useState('');
  const [path, setPath] = useState('$.');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    try {
      const data = JSON.parse(json);
      const r = evalPath(data, path);
      setResult(r === undefined ? '(undefined)' : JSON.stringify(r, null, 2));
    } catch (e: any) {
      setError(e.message);
      setResult('');
    }
  };

  return (
    <ToolShell title="JSONPath 求值" description="输入 $.a.b[0] 实时提取 JSON 字段"
      fillHeight
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>JSON</div>
            <Input.TextArea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{"users":[{"name":"Tom","age":18}]}'
              style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>结果</div>
            {error ? (
              <div
                style={{
                  flex: 1,
                  padding: 12,
                  color: colors.error,
                  fontSize: 13,
                  background: 'rgba(248,113,113,0.08)',
                  border: `1px solid ${colors.error}`,
                  borderRadius: 'var(--radius-md)',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {error}
              </div>
            ) : (
              <JsonHighlight code={result} style={{ flex: 1, minHeight: 0 }} />
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            flexShrink: 0,
            paddingTop: 12,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onPressEnter={run}
            placeholder="$.users[0].name"
            size="small"
            style={{ width: 260, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <Button size="small" type="primary" onClick={run} disabled={!json.trim()}>求值</Button>
        </div>
      </div>
    </ToolShell>
  );
};

export default JsonPathTool;
