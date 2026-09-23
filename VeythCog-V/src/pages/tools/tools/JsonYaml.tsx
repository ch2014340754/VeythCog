import React, { useState } from 'react';
import { Input, Button } from 'antd';
import * as yaml from 'js-yaml';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const JsonYaml: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'json2yaml' | 'yaml2json'>('json2yaml');
  const [error, setError] = useState('');

  const convert = () => {
    setError('');
    try {
      if (mode === 'json2yaml') {
        const data = JSON.parse(input);
        setOutput(yaml.dump(data, { indent: 2 }));
      } else {
        const data = yaml.load(input);
        setOutput(JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      setError(`转换失败：${e.message}`);
      setOutput('');
    }
  };

  return (
    <ToolShell
      title="JSON ↔ YAML"
      description="JSON 和 YAML 互转"
      fillHeight
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
              {mode === 'json2yaml' ? 'JSON' : 'YAML'}
            </div>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'json2yaml' ? '{"a":1,"b":[1,2]}' : 'a: 1\nb:\n  - 1\n  - 2'}
              style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
            />
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
          <Button size="small" type={mode === 'json2yaml' ? 'primary' : 'default'} onClick={() => setMode('json2yaml')}>
            JSON → YAML
          </Button>
          <Button size="small" type={mode === 'yaml2json' ? 'primary' : 'default'} onClick={() => setMode('yaml2json')}>
            YAML → JSON
          </Button>
          <div style={{ flex: 1 }} />
          <Button size="small" type="primary" onClick={convert} disabled={!input.trim()}>转换</Button>
        </div>
      </div>
    </ToolShell>
  );
};

export default JsonYaml;
