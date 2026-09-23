import React, { useState } from 'react';
import { Input, Button, Radio } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const HexTool: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    try {
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        setOutput(Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' '));
      } else {
        const clean = input.replace(/[\s,]/g, '');
        const bytes = new Uint8Array(clean.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
        setOutput(new TextDecoder().decode(bytes));
      }
    } catch (e: any) {
      setError('转换失败：' + e.message);
      setOutput('');
    }
  };

  return (
    <ToolShell title="Hex 编解码" description="文本与十六进制互转，支持中文"
      fillHeight
      actions={
        <Radio.Group size="small" value={mode} onChange={(e) => setMode(e.target.value)}>
          <Radio.Button value="encode">文本→Hex</Radio.Button>
          <Radio.Button value="decode">Hex→文本</Radio.Button>
        </Radio.Group>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输入</div>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'encode' ? '输入文本' : '48 65 6c 6c 6f'}
            style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
          />
          <Button size="small" type="primary" onClick={run} disabled={!input.trim()} style={{ marginTop: 8, alignSelf: 'flex-start' }}>转换</Button>
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

export default HexTool;
