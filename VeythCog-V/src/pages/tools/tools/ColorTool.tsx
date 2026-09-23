import React, { useState } from 'react';
import { Input } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const ColorTool: React.FC = () => {
  const { colors } = useTheme();
  const [hex, setHex] = useState('#7C3AED');

  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;

  return (
    <ToolShell title="颜色转换" description="HEX / RGB / HSL 互转，带取色器">
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 'var(--radius-lg)',
              background: rgb ? hex : colors.surface,
              border: `1px solid ${colors.border}`,
              marginBottom: 12,
            }}
          />
          <input
            type="color"
            value={rgb ? hex : '#000000'}
            onChange={(e) => setHex(e.target.value)}
            style={{ width: 160, height: 40, border: 'none', cursor: 'pointer', borderRadius: 8 }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>HEX</div>
          <Input value={hex} onChange={(e) => setHex(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>RGB</div>
          <Input readOnly value={rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : ''} style={{ fontFamily: 'monospace' }} />
          <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>HSL</div>
          <Input readOnly value={hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : ''} style={{ fontFamily: 'monospace' }} />
        </div>
      </div>
    </ToolShell>
  );
};

export default ColorTool;
