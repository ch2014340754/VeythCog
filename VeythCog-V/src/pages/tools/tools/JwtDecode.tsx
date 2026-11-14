import React, { useState } from 'react';
import { Input } from 'antd';
import ToolShell from '../ToolShell';
import JsonHighlight from '../components/JsonHighlight';

function decodeJwtSegment(seg: string): string {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
  } catch {
    return '(解码失败)';
  }
}

const JwtDecode: React.FC = () => {
  const [token, setToken] = useState('');

  const parts = token.trim().split('.');
  const header = parts.length === 3 ? decodeJwtSegment(parts[0]) : '';
  const payload = parts.length === 3 ? decodeJwtSegment(parts[1]) : '';

  return (
    <ToolShell
      title="JWT 解码"
      description="只解析 header / payload，不验签。别粘贴生产环境密钥"
      fillHeight
    >
      <div className="vc-tool-split">
        <div className="vc-tool-pane">
          <div className="vc-tool-pane__head">
            <span className="vc-tool-pane__label">JWT Token</span>
            <div className="vc-tool-pane__side">
              <span className="vc-meta">{parts.length === 3 ? '3 段' : '等待输入'}</span>
            </div>
          </div>
          <div className="vc-tool-pane__body">
            <Input.TextArea
              className="vc-mono-input"
              variant="borderless"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minHeight: 0 }}>
          <div className="vc-tool-pane" style={{ flex: 1 }}>
            <div className="vc-tool-pane__head">
              <span className="vc-tool-pane__label">Header</span>
            </div>
            <JsonHighlight code={header} style={{ flex: 1, minHeight: 0 }} />
          </div>
          <div className="vc-tool-pane" style={{ flex: 1 }}>
            <div className="vc-tool-pane__head">
              <span className="vc-tool-pane__label">Payload</span>
            </div>
            <JsonHighlight code={payload} style={{ flex: 1, minHeight: 0 }} />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default JwtDecode;
