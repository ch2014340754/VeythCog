import React, { useState } from 'react';
import { Input, Button } from 'antd';
import ToolShell from '../ToolShell';
import JsonHighlight from '../components/JsonHighlight';

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
    <ToolShell title="JSONPath 求值" description="输入 $.a.b[0] 实时提取 JSON 字段" fillHeight>
      <div className="vc-tool-split">
        <div className={`vc-tool-pane${error ? ' has-error' : ''}`}>
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">JSON</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{json.length.toLocaleString()} 字符</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{"users":[{"name":"Tom","age":18}]}'
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">结果</span>
            <div className="vc-tool-pane__side">
              <span className="vc-mono" style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{path}</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            {error ? (
              <div className="vc-tool-error">{error}</div>
            ) : (
              <JsonHighlight code={result} style={{ flex: 1, minHeight: 0 }} />
            )}
          </div>
        </div>
      </div>

      <div className="vc-tool-bar">
        <Input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onPressEnter={run}
          placeholder="$.users[0].name"
          className="vc-mono-input"
          style={{ width: 300 }}
        />
        <Button type="primary" onClick={run} disabled={!json.trim()}>求值</Button>
      </div>
    </ToolShell>
  );
};

export default JsonPathTool;
