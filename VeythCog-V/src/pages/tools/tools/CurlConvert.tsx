import React, { useState } from 'react';
import { Input, Button, Segmented, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import ToolShell from '../ToolShell';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

function parseCurl(cmd: string): ParsedCurl {
  const s = cmd.trim().replace(/^curl\s+/, '');
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

  const copy = () => {
    navigator.clipboard.writeText(output);
    message.success('已复制');
  };

  return (
    <ToolShell
      title="cURL 转代码"
      description="粘贴 cURL 命令生成 fetch / axios"
      fillHeight
      actions={
        <div className="vc-toolbar" style={{ padding: 0, border: 'none', background: 'transparent' }}>
          <Segmented
            className="vc-segmented"
            value={target}
            onChange={(v) => setTarget(v as 'fetch' | 'axios')}
            options={[
              { label: 'fetch', value: 'fetch' },
              { label: 'axios', value: 'axios' },
            ]}
          />
          <Button type="primary" onClick={run} disabled={!input.trim()}>
            转换
          </Button>
        </div>
      }
    >
      <div className="vc-tool-split">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">cURL 命令</span>
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
              placeholder={'curl -X POST https://api.example.com/users -H "Content-Type: application/json" -d \'{"name":"test"}\''}
            />
          </div>
        </div>

        <div className={`vc-tool-pane${error ? ' has-error' : ''}`}>
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">生成代码</span>
            <div className="vc-tool-pane__side">
              <button className="vc-icon-btn" onClick={copy} disabled={!output}>
                <Icon icon={copyIcon} width={13} /> 复制
              </button>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            {error ? <div className="vc-tool-error">{error}</div> : null}
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={output}
              readOnly
              placeholder="生成的代码会出现在这里"
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default CurlConvert;
