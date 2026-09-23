import React, { useState } from 'react';
import { Input, Button, message, Radio } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import checkIcon from '@iconify-icons/lucide/check';
import ToolShell from '../ToolShell';
import JsonHighlight from '../components/JsonHighlight';
import { useTheme } from '@/contexts/ThemeContext';

const JsonFormatter: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [indent, setIndent] = useState<2 | 4>(2);
  const [copied, setCopied] = useState(false);

  const tryParse = (): any | null => {
    try {
      setError('');
      return JSON.parse(input);
    } catch (e: any) {
      setOutput('');
      setError(`解析错误：${e.message}`);
      return null;
    }
  };

  const handleFormat = () => {
    const data = tryParse();
    if (data != null) setOutput(JSON.stringify(data, null, indent));
  };

  const handleMinify = () => {
    const data = tryParse();
    if (data != null) setOutput(JSON.stringify(data));
  };

  const handleEscape = () => {
    // 把输出转义成可粘贴到 JS 字符串里的形式
    setError('');
    try {
      setOutput(JSON.stringify(input));
    } catch (e: any) {
      setError('转义失败：' + e.message);
      setOutput('');
    }
  };

  const handleUnescape = () => {
    setError('');
    try {
      setOutput(JSON.parse(input));
    } catch (e: any) {
      setError('反转义失败：' + e.message);
      setOutput('');
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    message.success('已复制');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolShell
      title="JSON 格式化"
      description="格式化、压缩、转义 JSON，错误会定位到具体信息"
      fillHeight
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输入</div>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"hello":"world","nested":[1,2,3]}'
              style={{
                flex: 1,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                fontSize: 13,
                minHeight: 0,
                background: error ? 'rgba(248,113,113,0.08)' : undefined,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输出</div>
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
              <JsonHighlight code={output} style={{ flex: 1, minHeight: 0 }} />
            )}
          </div>
        </div>
        {/* 底部工具栏 */}
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
          <Button size="small" type="primary" onClick={handleFormat} disabled={!input.trim()}>格式化</Button>
          <Button size="small" onClick={handleMinify} disabled={!input.trim()}>压缩</Button>
          <Button size="small" onClick={handleEscape} disabled={!input.trim()}>转义</Button>
          <Button size="small" onClick={handleUnescape} disabled={!input.trim()}>反转义</Button>
          <Radio.Group size="small" value={indent} onChange={(e) => setIndent(e.target.value)} style={{ marginLeft: 8 }}>
            <Radio.Button value={2}>2 空格</Radio.Button>
            <Radio.Button value={4}>4 空格</Radio.Button>
          </Radio.Group>
          <div style={{ flex: 1 }} />
          <Button size="small" onClick={handleCopy} disabled={!output}>
            <Icon icon={copied ? checkIcon : copyIcon} width={14} />
          </Button>
        </div>
      </div>
    </ToolShell>
  );
};

export default JsonFormatter;
