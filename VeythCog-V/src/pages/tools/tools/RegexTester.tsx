import React, { useMemo, useState } from 'react';
import { Input } from 'antd';
import ToolShell from '../ToolShell';

const COMMON_REGEX = [
  { label: '邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+' },
  { label: '手机号', pattern: '1[3-9]\\d{9}' },
  { label: 'IP', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' },
  { label: 'URL', pattern: 'https?://[\\w./?&=%-]+' },
  { label: '身份证', pattern: '\\d{17}[\\dXx]' },
  { label: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}' },
];

const RegexTester: React.FC = () => {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const matches = useMemo(() => {
    setError('');
    if (!pattern) return [];
    try {
      const re = new RegExp(pattern, flags);
      const result: { start: number; end: number; text: string }[] = [];
      let m;
      while ((m = re.exec(text)) !== null) {
        result.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
        if (!re.global) break;
      }
      return result;
    } catch (e: any) {
      setError(e.message);
      return [];
    }
  }, [pattern, flags, text]);

  const highlighted = useMemo(() => {
    if (matches.length === 0) return text;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((m, i) => {
      if (m.start > last) nodes.push(text.slice(last, m.start));
      nodes.push(
        <mark key={i} className="vc-mark">
          {text.slice(m.start, m.end)}
        </mark>
      );
      last = m.end;
    });
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }, [matches, text]);

  return (
    <ToolShell title="正则测试器" description="实时高亮匹配结果" fillHeight>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', flex: 1, minHeight: 0 }}>
        <div className="vc-regex-bar" style={{ flexShrink: 0 }}>
          <span className="vc-regex-slash">/</span>
          <Input
            className="vc-mono-input"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="输入正则，如 \\d+"
            style={{ flex: 1, minWidth: 200 }}
          />
          <span className="vc-regex-slash">/</span>
          <Input
            className="vc-mono-input"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="g"
            style={{ width: 88 }}
          />
          {COMMON_REGEX.map((r) => (
            <button key={r.label} className="vc-chip" onClick={() => setPattern(r.pattern)}>
              {r.label}
            </button>
          ))}
        </div>

        {error && <div className="vc-tool-error" style={{ flexShrink: 0 }}>{error}</div>}

        <div className="vc-tool-split">
          <div className="vc-tool-pane">
            <div className="vc-tool-pane__head">
              <span className="vc-tool-pane__label">测试文本</span>
              <div className="vc-tool-pane__side">
                <span className="vc-meta">{text.length.toLocaleString()} 字符</span>
              </div>
            </div>
            <div className="vc-tool-pane__body">
              <Input.TextArea
                className="vc-mono-input"
                variant="borderless"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入要测试的文本"
              />
            </div>
          </div>

          <div className="vc-tool-pane">
            <div className="vc-tool-pane__head">
              <span className="vc-tool-pane__label">匹配结果</span>
              <div className="vc-tool-pane__side">
                <span className="vc-meta">{matches.length} 处</span>
              </div>
            </div>
            <pre className="vc-json-pre" style={{ flex: 1, minHeight: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {highlighted}
            </pre>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default RegexTester;
