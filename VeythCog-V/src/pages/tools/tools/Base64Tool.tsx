import React, { useState } from 'react';
import { Input, Button, Radio } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

function b64encode(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}
function b64decode(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

const Base64Tool: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    try {
      setOutput(mode === 'encode' ? b64encode(input) : b64decode(input));
    } catch (e: any) {
      setError('编码失败：' + e.message);
      setOutput('');
    }
  };

  return (
    <ToolShell title="Base64 编解码" description="支持中文，使用 UTF-8"
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
            placeholder={mode === 'encode' ? '输入要编码的文本' : '输入 Base64 字符串'}
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

export default Base64Tool;
