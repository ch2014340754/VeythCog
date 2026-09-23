import React, { useState } from 'react';
import { Input } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { colors } = useTheme();
  const [token, setToken] = useState('');

  const parts = token.trim().split('.');
  const header = parts.length === 3 ? decodeJwtSegment(parts[0]) : '';
  const payload = parts.length === 3 ? decodeJwtSegment(parts[1]) : '';

  return (
    <ToolShell title="JWT 解码" description="只解析 header / payload，不验签。别粘贴生产环境密钥"
      fillHeight
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>JWT Token</div>
          <Input.TextArea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Header</div>
            <Input.TextArea
              value={header}
              readOnly
              style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Payload</div>
            <Input.TextArea
              value={payload}
              readOnly
              style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default JwtDecode;
