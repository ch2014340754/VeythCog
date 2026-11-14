import React, { useState } from 'react';
import { Input } from 'antd';
import ToolShell from '../ToolShell';

const BaseConverter: React.FC = () => {
  const [bin, setBin] = useState('');
  const [oct, setOct] = useState('');
  const [dec, setDec] = useState('');
  const [hex, setHex] = useState('');

  const sync = (from: 'bin' | 'oct' | 'dec' | 'hex', value: string) => {
    const radix = from === 'bin' ? 2 : from === 'oct' ? 8 : from === 'dec' ? 10 : 16;
    const n = value ? parseInt(value, radix) : 0;
    if (Number.isNaN(n)) return;
    setBin(from === 'bin' ? value : n.toString(2));
    setOct(from === 'oct' ? value : n.toString(8));
    setDec(from === 'dec' ? value : n.toString(10));
    setHex(from === 'hex' ? value : n.toString(16).toUpperCase());
  };

  const fields: { label: string; value: string; onChange: (v: string) => void; ph: string }[] = [
    { label: '二进制 (2)', value: bin, onChange: (v) => sync('bin', v), ph: '1010' },
    { label: '八进制 (8)', value: oct, onChange: (v) => sync('oct', v), ph: '12' },
    { label: '十进制 (10)', value: dec, onChange: (v) => sync('dec', v), ph: '10' },
    { label: '十六进制 (16)', value: hex, onChange: (v) => sync('hex', v), ph: 'A' },
  ];

  return (
    <ToolShell title="进制转换" description="二/八/十/十六进制互转">
      <div className="vc-panel">
        <div className="vc-panel__head">
          <div>
            <h2 className="vc-panel__title">进制换算</h2>
            <p className="vc-panel__desc">在任意一个输入框里改动，其余三个会同步换算。</p>
          </div>
        </div>
        <div className="vc-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {fields.map((f) => (
            <div key={f.label}>
              <div className="vc-field-label">{f.label}</div>
              <Input
                className="vc-mono-input"
                value={f.value}
                onChange={(e) => f.onChange(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
                placeholder={f.ph}
              />
            </div>
          ))}
        </div>
      </div>
    </ToolShell>
  );
};

export default BaseConverter;
