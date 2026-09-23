import React, { useMemo, useState } from 'react';
import { Input, Tag } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const COMMON_REGEX = [
  { label: '邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+' },
  { label: '手机号', pattern: '1[3-9]\\d{9}' },
  { label: 'IP', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}' },
  { label: 'URL', pattern: 'https?://[\\w./?&=%-]+' },
  { label: '身份证', pattern: '\\d{17}[\\dXx]' },
  { label: '日期', pattern: '\\d{4}-\\d{2}-\\d{2}' },
];

const RegexTester: React.FC = () => {
  const { colors } = useTheme();
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
        <mark key={i} style={{ background: colors.primary15, color: colors.primary, borderRadius: 2, padding: '0 2px' }}>
          {text.slice(m.start, m.end)}
        </mark>
      );
      last = m.end;
    });
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }, [matches, text, colors]);

  return (
    <ToolShell title="正则测试器" description="实时高亮匹配结果" fillHeight>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: colors.textTertiary }}>/</span>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="输入正则，如 \d+"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: colors.textTertiary }}>/</span>
          <Input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="g"
            style={{ width: 80, fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>
        {error && <div style={{ color: colors.error, fontSize: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {COMMON_REGEX.map((r) => (
            <Tag key={r.label} color="default" style={{ cursor: 'pointer' }} onClick={() => setPattern(r.pattern)}>
              {r.label}
            </Tag>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>测试文本</div>
            <Input.TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入要测试的文本"
              style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
              匹配结果（{matches.length} 处）
            </div>
            <div
              style={{
                flex: 1,
                padding: 12,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-md)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                overflow: 'auto',
              }}
            >
              {highlighted}
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default RegexTester;
