import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import { format } from 'sql-formatter';
import ToolShell from '../ToolShell';

const SqlFormatter: React.FC = () => {
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

  const copy = () => {
    navigator.clipboard.writeText(output);
    message.success('已复制');
  };

  return (
    <ToolShell
      title="SQL 格式化"
      description="关键字大写、缩进美化"
      fillHeight
      actions={
        <Button type="primary" onClick={run} disabled={!input.trim()}>
          格式化
        </Button>
      }
    >
      <div className="vc-tool-split">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输入 SQL</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{input.length.toLocaleString()} 字符</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="SELECT * FROM users WHERE id = 1"
            />
          </div>
        </div>

        <div className={`vc-tool-pane${error ? ' has-error' : ''}`}>
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">格式化结果</span>
            <div className="vc-tool-pane__side">
              <button className="vc-icon-btn" onClick={copy} disabled={!output}>
                <Icon icon={copyIcon} width={13} /> 复制
              </button>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            {error ? <div className="vc-tool-error">{error}</div> : null}
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={output}
              readOnly
              placeholder="格式化结果会出现在这里"
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default SqlFormatter;
