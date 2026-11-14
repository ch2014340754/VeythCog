import React, { useState } from 'react';
import { Input } from 'antd';
import ReactMarkdown from 'react-markdown';
import ToolShell from '../ToolShell';

const DEFAULT_TEXT = [
  '# 标题',
  '',
  '**加粗** *斜体*',
  '',
  '- 列表 1',
  '- 列表 2',
  '',
  '```js',
  'console.log("hello")',
  '```',
].join('\n');

const MarkdownPreview: React.FC = () => {
  const [text, setText] = useState(DEFAULT_TEXT);

  return (
    <ToolShell title="Markdown 预览" description="左边写右边实时渲染" fillHeight>
      <div className="vc-tool-split">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">Markdown</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{text.length.toLocaleString()} 字符</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">预览</span>
          </div>
          <div className="md-body vc-md-preview">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default MarkdownPreview;
