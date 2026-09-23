import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { format } from 'sql-formatter';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const SqlFormatter: React.FC = () => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const run = () => {
    setError('');
    try {
      setOutput(format(input, { language: 'sql', keywordCase: 'upper', tabWidth: 2 }));
    } catch (e: any) {
      setError('格式化失败：' + e.message);
      setOutput('');
    }
  };

  return (
    <ToolShell title="SQL 格式化" description="关键字大写、缩进美化"
      fillHeight
      actions={<Button size="small" type="primary" onClick={run} disabled={!input.trim()}>格式化</Button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>输入 SQL</div>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="SELECT * FROM users WHERE id = 1"
            style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>格式化结果</div>
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

export default SqlFormatter;
