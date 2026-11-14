import checkIcon from '@iconify-icons/lucide/check';
import collapseAllIcon from '@iconify-icons/lucide/chevrons-down-up';
import expandAllIcon from '@iconify-icons/lucide/chevrons-up-down';
import copyIcon from '@iconify-icons/lucide/copy';
import { Icon } from '@iconify/react';
import { Button, Input, message, Radio, Tooltip } from 'antd';
import React, { useRef, useState } from 'react';
import ToolShell from '../ToolShell';
import JsonTreeView, { JsonTreeHandle } from '../components/JsonTreeView';

const JsonFormatter: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [indent, setIndent] = useState<2 | 4>(2);
  const [copied, setCopied] = useState(false);
  const treeRef = useRef<JsonTreeHandle>(null);

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
      <div className="vc-tool-split">
        <div className={`vc-tool-pane${error ? ' has-error' : ''}`}>
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输入</span>
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
              placeholder='{"hello":"world","nested":[1,2,3]}'
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输出</span>
            <div className="vc-tool-pane__side">
              <Tooltip title="展开全部">
                <Button
                  type="text"
                  icon={<Icon icon={expandAllIcon} width={16} />}
                  onClick={() => treeRef.current?.expandAll()}
                  disabled={!output}
                />
              </Tooltip>
              <Tooltip title="折叠全部">
                <Button
                  type="text"
                  icon={<Icon icon={collapseAllIcon} width={16} />}
                  onClick={() => treeRef.current?.collapseAll()}
                  disabled={!output}
                />
              </Tooltip>
            </div>
          </div>
          {error ? (
            <div className="vc-tool-error" style={{ margin: 0, border: 'none', borderRadius: 0, background: 'transparent' }}>
              {error}
            </div>
          ) : (
            <JsonTreeView ref={treeRef} code={output} style={{ flex: 1, minHeight: 0 }} />
          )}
        </div>
      </div>

      <div className="vc-tool-bar">
        <Button type="primary" onClick={handleFormat} disabled={!input.trim()}>格式化</Button>
        <Button onClick={handleMinify} disabled={!input.trim()}>压缩</Button>
        <Button onClick={handleEscape} disabled={!input.trim()}>转义</Button>
        <Button onClick={handleUnescape} disabled={!input.trim()}>反转义</Button>
        <Radio.Group value={indent} onChange={(e) => setIndent(e.target.value)} style={{ marginLeft: 8 }}>
          <Radio.Button value={2}>2 空格</Radio.Button>
          <Radio.Button value={4}>4 空格</Radio.Button>
        </Radio.Group>
        <div className="vc-tool-bar__spacer" />
        <Button onClick={handleCopy} disabled={!output} icon={<Icon icon={copied ? checkIcon : copyIcon} width={16} />}>
          复制
        </Button>
      </div>
    </ToolShell>
  );
};

export default JsonFormatter;
