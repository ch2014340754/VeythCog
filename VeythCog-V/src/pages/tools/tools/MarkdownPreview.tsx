import React, { useState } from 'react';
import { Input } from 'antd';
import ReactMarkdown from 'react-markdown';
import ToolShell from '../ToolShell';

const MarkdownPreview: React.FC = () => {
  const [text, setText] = useState('# 标题\n\n**加粗** *斜体*\n\n- 列表 1\n- 列表 2\n\n```js\nconsole.log("hello")\n```');

  return (
    <ToolShell title="Markdown 预览" description="左边写右边实时渲染" fillHeight>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
        />
        <div
          className="md-body"
          style={{
            padding: 16,
            overflow: 'auto',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>
    </ToolShell>
  );
};

export default MarkdownPreview;
