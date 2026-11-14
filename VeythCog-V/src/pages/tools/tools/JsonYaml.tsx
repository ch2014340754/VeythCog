import React, { useState } from 'react';
import { Input, Button, Segmented } from 'antd';
import * as yaml from 'js-yaml';
import ToolShell from '../ToolShell';

const JsonYaml: React.FC = () => {
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
    <ToolShell title="JSON ↔ YAML" description="JSON 和 YAML 互转" fillHeight>
      <div className="vc-tool-split">
        <div className={`vc-tool-pane${error ? ' has-error' : ''}`}>
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">{mode === 'json2yaml' ? 'JSON' : 'YAML'}</span>
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
              placeholder={mode === 'json2yaml' ? '{"a":1,"b":[1,2]}' : 'a: 1\nb:\n  - 1\n  - 2'}
            />
          </div>
        </div>

        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">输出</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{output.length.toLocaleString()} 字符</span>
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
                placeholder="转换结果"
              />
            )}
          </div>
        </div>
      </div>

      <div className="vc-tool-bar">
        <Segmented
          className="vc-segmented"
          value={mode}
          onChange={(v) => setMode(v as 'json2yaml' | 'yaml2json')}
          options={[
            { label: 'JSON → YAML', value: 'json2yaml' },
            { label: 'YAML → JSON', value: 'yaml2json' },
          ]}
        />
        <div className="vc-tool-bar__spacer" />
        <Button type="primary" onClick={convert} disabled={!input.trim()}>转换</Button>
      </div>
    </ToolShell>
  );
};

export default JsonYaml;
