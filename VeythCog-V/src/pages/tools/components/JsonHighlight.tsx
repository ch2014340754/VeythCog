import React, { useMemo } from 'react';

/**
 * 轻量 JSON 语法高亮（只读展示用）
 * key -> primary, string -> success, number -> warning, true/false/null -> error
 * 颜色全部来自 CSS 变量，跟随主题与暗色模式。
 */
export function highlightJson(code: string): React.ReactNode {
  if (!code) return null;
  const nodes: React.ReactNode[] = [];
  // 匹配："key" 后跟冒号 / "string" / number / true/false/null / 其他
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|(true|false|null)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) nodes.push(<span key={i++}>{code.slice(last, m.index)}</span>);
    if (m[1] !== undefined) {
      // 字符串
      const isKey = !!m[2];
      nodes.push(
        <span key={i++} className={isKey ? 'vc-json-key' : 'vc-json-str'}>
          {m[1]}
        </span>
      );
      if (m[2]) nodes.push(<span key={i++} className="vc-json-punct">{m[2]}</span>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <span key={i++} className="vc-json-num">
          {m[3]}
        </span>
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <span key={i++} className="vc-json-lit">
          {m[4]}
        </span>
      );
    }
    last = re.lastIndex;
  }
  if (last < code.length) nodes.push(<span key={i++}>{code.slice(last)}</span>);
  return nodes;
}

interface Props {
  code: string;
  style?: React.CSSProperties;
}

/** 只读 JSON 高亮块，带滚动 */
const JsonHighlight: React.FC<Props> = ({ code, style }) => {
  const content = useMemo(() => highlightJson(code), [code]);
  return (
    <pre className="vc-json-pre" style={style}>
      {content || <span className="vc-json-muted">（空）</span>}
    </pre>
  );
};

export default JsonHighlight;
