import React, { useState } from 'react';
import { Button, Slider, Switch, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import ToolShell from '../ToolShell';

const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()_+-=[]{};:,.<>?',
};

function genPassword(length: number, opts: { upper: boolean; digit: boolean; symbol: boolean }): string {
  let pool = CHARSETS.lower;
  if (opts.upper) pool += CHARSETS.upper;
  if (opts.digit) pool += CHARSETS.digit;
  if (opts.symbol) pool += CHARSETS.symbol;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((n) => pool[n % pool.length]).join('');
}

/** 密码生成器：crypto.getRandomValues 本地生成，不上传任何内容 */
const PasswordTool: React.FC = () => {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [digit, setDigit] = useState(true);
  const [symbol, setSymbol] = useState(true);
  const [pwd, setPwd] = useState('');

  const regenerate = () => setPwd(genPassword(length, { upper, digit, symbol }));

  const copy = () => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    message.success('已复制');
  };

  return (
    <ToolShell
      title="密码生成器"
      description="密码学安全随机数（crypto.getRandomValues）"
      actions={
        <Button type="primary" icon={<Icon icon={refreshIcon} width={16} />} onClick={regenerate}>
          生成
        </Button>
      }
    >
      <div className="vc-stack">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">生成结果</span>
            <span className="vc-tool-pane__side vc-meta">{pwd ? pwd.length + ' 位' : '等待生成'}</span>
          </div>
          <div className="vc-tool-pane__body">
            <div className={"vc-pwd-value" + (pwd ? "" : " is-empty")}>{pwd || '点击右上角「生成」创建密码'}</div>
            <div className="vc-tool-bar">
              <span className="vc-tool-note">仅在本地浏览器生成，不会上传服务器</span>
              <span className="vc-tool-bar__spacer" />
              <Button icon={<Icon icon={copyIcon} width={16} />} onClick={copy} disabled={!pwd}>
                复制
              </Button>
            </div>
          </div>
        </div>

        <div className="vc-panel">
          <div className="vc-panel__head">
            <span className="vc-panel__title">生成选项</span>
            <span className="vc-meta">默认包含小写字母</span>
          </div>
          <div className="vc-stack vc-stack--tight">
            <div className="vc-setting-row">
              <div className="vc-setting-row__label">
                <span className="vc-setting-row__title">密码长度</span>
                <span className="vc-num">{length}</span>
              </div>
              <Slider min={4} max={64} value={length} onChange={setLength} style={{ maxWidth: 320 }} />
            </div>
            <div className="vc-setting-row">
              <div className="vc-setting-row__label">
                <span className="vc-setting-row__title">
                  大写字母 <span className="vc-hint">A-Z</span>
                </span>
                <Switch checked={upper} onChange={setUpper} />
              </div>
            </div>
            <div className="vc-setting-row">
              <div className="vc-setting-row__label">
                <span className="vc-setting-row__title">
                  数字 <span className="vc-hint">0-9</span>
                </span>
                <Switch checked={digit} onChange={setDigit} />
              </div>
            </div>
            <div className="vc-setting-row">
              <div className="vc-setting-row__label">
                <span className="vc-setting-row__title">
                  符号 <span className="vc-hint">!@#$%^&amp;* 等</span>
                </span>
                <Switch checked={symbol} onChange={setSymbol} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default PasswordTool;
