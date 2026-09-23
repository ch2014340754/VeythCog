import React, { useState } from 'react';
import { Input, Button, Radio } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

function parseCurl(cmd: string): ParsedCurl {
  let s = cmd.trim().replace(/^curl\s+/, '');
  const result: ParsedCurl = { method: 'GET', url: '', headers: {}, body: '' };
  const tokens: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (/\s/.test(c)) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-X' || t === '--request') {
      result.method = tokens[++i].toUpperCase();
    } else if (t === '-H' || t === '--header') {
      const h = tokens[++i];
      const idx = h.indexOf(':');
      if (idx > 0) result.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
      result.body = tokens[++i];
      if (result.method === 'GET') result.method = 'POST';
    } else if (t === '-u' || t === '--user') {
      result.headers['Authorization'] = 'Basic ' + btoa(tokens[++i]);
    } else if (!t.startsWith('-')) {
      result.url = t;
    }
  }
  return result;
}

function toFetch(p: ParsedCurl): string {
  const lines = [`fetch("${p.url}", {`];
  lines.push(`  method: "${p.method}",`);
  if (Object.keys(p.headers).length) {
    lines.push(`  headers: ${JSON.stringify(p.headers, null, 2).replace(/\n/g, '\n  ')},`);
  }
  if (p.body) lines.push(`  body: ${JSON.stringify(p.body)},`);
  lines.push('})');
  lines.push('  .then(res => res.json())');
  lines.push('  .then(data => console.log(data));');
  return lines.join('\n');
}

function toAxios(p: ParsedCurl): string {
  const cfg: Record<string, unknown> = { method: p.method.toLowerCase(), url: p.url };
  if (Object.keys(p.headers).length) cfg.headers = p.headers;
  if (p.body) cfg.data = p.body;
  return `axios(${JSON.stringify(cfg, null, 2)})\n  .then(res => console.log(res.data));`;
}

const CurlConvert: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<'fetch' | 'axios'>('fetch');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    try {
      const parsed = parseCurl(input);
      setOutput(target === 'fetch' ? toFetch(parsed) : toAxios(parsed));
    } catch (e: any) {
      setError('解析失败：' + e.message);
      setOutput('');
    }
  };

  return (
    <ToolShell title="cURL 转代码" description="粘贴 cURL 命令生成 fetch / axios"
      fillHeight
      actions={
        <>
          <Radio.Group size="small" value={target} onChange={(e) => setTarget(e.target.value)}>
            <Radio.Button value="fetch">fetch</Radio.Button>
            <Radio.Button value="axios">axios</Radio.Button>
          </Radio.Group>
          <Button size="small" type="primary" onClick={run} disabled={!input.trim()}>转换</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>cURL 命令</div>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"test"}\''}
            style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>生成代码</div>
          <Input.TextArea
            value={error || output}
            readOnly
            style={{
              flex: 1,
              minHeight: 0,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: 13,
              color: error ? colors.error : colors.text,
            }}
          />
        </div>
      </div>
    </ToolShell>
  );
};

export default CurlConvert;
