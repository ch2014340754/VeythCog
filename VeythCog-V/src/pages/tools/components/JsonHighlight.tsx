import React, { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * 轻量 JSON 语法高亮（只读展示用）
 * key -> primary, string -> success, number -> warning, true/false/null -> error
 */
export function highlightJson(code: string, colors: any): React.ReactNode {
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
        <span key={i++} style={{ color: isKey ? colors.primary : colors.success }}>
          {m[1]}
        </span>
      );
      if (m[2]) nodes.push(<span key={i++}>{m[2]}</span>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <span key={i++} style={{ color: colors.warning }}>
          {m[3]}
        </span>
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <span key={i++} style={{ color: colors.error }}>
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
  const { colors } = useTheme();
  const content = useMemo(() => highlightJson(code, colors), [code, colors]);
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflow: 'auto',
        ...style,
      }}
    >
      {content}
    </pre>
  );
};

export default JsonHighlight;
