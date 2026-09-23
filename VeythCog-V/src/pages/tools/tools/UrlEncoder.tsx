import React, { useState } from 'react';
import { Input, Button, Radio } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const UrlEncoder: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    try {
      setOutput(mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input));
    } catch (e: any) {
      setError('操作失败：' + e.message);
      setOutput('');
    }
  };

  return (
    <ToolShell title="URL 编解码" description="encodeURIComponent / decodeURIComponent"
      fillHeight
      actions={
        <Radio.Group size="small" value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="encode">编码</Radio.Button>
          <Radio.Button value="decode">解码</Radio.Button>
        </Radio.Group>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输入</div>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? '输入 URL 参数或文本' : '输入 %E4%B8%AD%E6%96%87 这种字符串'}
            style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
          />
          <Button size="small" type="primary" onClick={run} disabled={!input.trim()} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            {mode === 'encode' ? '编码' : '解码'}
          </Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输出</div>
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

export default UrlEncoder;
