import React, { useState } from 'react';
import { Input, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import ToolShell from '../ToolShell';

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

const STYLES: { key: Style; label: string }[] = [
  { key: 'camel', label: 'camelCase' },
  { key: 'pascal', label: 'PascalCase' },
  { key: 'snake', label: 'snake_case' },
  { key: 'kebab', label: 'kebab-case' },
  { key: 'constant', label: 'CONSTANT_CASE' },
  { key: 'lower', label: 'lower case' },
  { key: 'upper', label: 'UPPER CASE' },
  { key: 'title', label: 'Title Case' },
];

const CaseConverter: React.FC = () => {
  const [input, setInput] = useState('');

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    message.success('已复制');
  };

  return (
    <ToolShell title="命名风格转换" description="自动识别输入中的单词边界，一键转换八种风格">
      <div className="vc-panel">
        <div className="vc-panel__head">
          <div>
            <h2 className="vc-panel__title">输入</h2>
            <p className="vc-panel__desc">粘贴任意命名风格的字符串，如 helloWorld / hello_world / Hello World。</p>
          </div>
          <span className="vc-meta">{input.length.toLocaleString()} 字符</span>
        </div>
        <Input.TextArea
          className="vc-mono-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴任意命名风格的字符串"
          autoSize={{ minRows: 3, maxRows: 6 }}
        />
      </div>

      <div className="vc-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {STYLES.map(({ key, label }) => {
          const value = input ? convert(input, key) : '';
          return (
            <div key={key} className="vc-card">
              <div className="vc-result-card__label">{label}</div>
              <div className="vc-result-card__value">{value || '—'}</div>
              <div className="vc-result-card__foot">
                {value && (
                  <button className="vc-icon-btn" onClick={() => copy(value)}>
                    <Icon icon={copyIcon} width={12} /> 复制
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
};

export default CaseConverter;
