import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

type Style = 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'lower' | 'upper' | 'title';

function toWords(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

function convert(s: string, style: Style): string {
  const words = toWords(s);
  switch (style) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
    case 'pascal':
      return words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
    case 'snake':
      return words.join('_');
    case 'kebab':
      return words.join('-');
    case 'constant':
      return words.join('_').toUpperCase();
    case 'lower':
      return words.join(' ');
    case 'upper':
      return words.join(' ').toUpperCase();
    case 'title':
      return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
}

const CaseConverter: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const styles: { key: Style; label: string }[] = [
    { key: 'camel', label: 'camelCase' },
    { key: 'pascal', label: 'PascalCase' },
    { key: 'snake', label: 'snake_case' },
    { key: 'kebab', label: 'kebab-case' },
    { key: 'constant', label: 'CONSTANT_CASE' },
    { key: 'lower', label: 'lower case' },
    { key: 'upper', label: 'UPPER CASE' },
    { key: 'title', label: 'Title Case' },
  ];

  return (
    <ToolShell title="命名风格转换" description="自动识别输入中的单词边界，一键转换八种风格">
      <Input.TextArea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="粘贴任意命名风格的字符串，如 helloWorld / hello_world / Hello World"
        autoSize={{ minRows: 3, maxRows: 6 }}
        style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13, marginBottom: 16 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {styles.map(({ key, label }) => (
          <div
            key={key}
            style={{
              padding: 12,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 4 }}>{label}</div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                fontSize: 13,
                wordBreak: 'break-all',
                minHeight: 20,
              }}
            >
              {input ? convert(input, key) : ''}
            </div>
            {input && (
              <button
                onClick={() => { navigator.clipboard.writeText(convert(input, key)); message.success('已复制'); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.primary, marginTop: 4, fontSize: 12 }}
              >
                <Icon icon={copyIcon} width={12} /> 复制
              </button>
            )}
          </div>
        ))}
      </div>
    </ToolShell>
  );
};

export default CaseConverter;
