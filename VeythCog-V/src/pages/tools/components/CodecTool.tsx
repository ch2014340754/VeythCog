import React, { useState } from 'react';
import { Button, Input, Segmented, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import checkIcon from '@iconify-icons/lucide/check';
import ToolShell from '../ToolShell';

export interface CodecOption {
  value: string;
  label: string;
  placeholder: string;
  /** 执行按钮文案 */
  actionLabel: string;
  /** 出错时的前缀，如「编码失败：」 */
  errorPrefix: string;
}

interface Props {
  title: string;
  description?: string;
  options: CodecOption[];
  /** 单次转换，抛错即视为失败 */
  convert: (mode: string, input: string) => string;
}

/**
 * 双向编解码类工具的通用壳子：左输入右输出、顶部模式切换、底部主操作。
 * 视觉统一走 .vc-tool-pane / .vc-tool-bar。
 */
const CodecTool: React.FC<Props> = ({ title, description, options, convert }) => {
  const [mode, setMode] = useState(options[0].value);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const current = options.find((o) => o.value === mode) ?? options[0];

  const run = () => {
    setError('');
    try {
      setOutput(convert(mode, input));
    } catch (e: any) {
      setError(`${current.errorPrefix}${e?.message ?? e}`);
      setOutput('');
    }
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    message.success('已复制');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolShell
      title={title}
      description={description}
      fillHeight
      actions={
        options.length > 1 ? (
          <Segmented
            className="vc-segmented"
            value={mode}
            onChange={(v) => {
              setMode(String(v));
              setError('');
            }}
            options={options.map((o) => ({ label: o.label, value: o.value }))}
          />
        ) : undefined
      }
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
              placeholder={current.placeholder}
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输出</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{output.length.toLocaleString()} 字符</span>
              <Button
                type="text"
                icon={<Icon icon={copied ? checkIcon : copyIcon} width={15} />}
                onClick={copy}
                disabled={!output}
                title="复制结果"
              />
            </div>
          </div>
          <div className="vc-tool-pane__body">
            {error ? (
              <div className="vc-tool-error">{error}</div>
            ) : (
              <Input.TextArea
                className="vc-mono-input"
                variant="borderless"
                value={output}
                readOnly
                placeholder="结果会出现在这里"
              />
            )}
          </div>
        </div>
      </div>

      <div className="vc-tool-bar">
        <Button type="primary" onClick={run} disabled={!input.trim()}>
          {current.actionLabel}
        </Button>
        <div className="vc-tool-bar__spacer" />
        <span className="vc-tool-note">{description}</span>
      </div>
    </ToolShell>
  );
};

export default CodecTool;
