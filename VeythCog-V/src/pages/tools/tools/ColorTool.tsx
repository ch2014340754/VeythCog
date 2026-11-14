import React, { useState } from 'react';
import { Input, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
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
  const [hex, setHex] = useState<string>(colors.primary);

  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  const rgbText = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '';
  const hslText = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '';

  const copy = (value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    message.success('已复制');
  };

  return (
    <ToolShell title="颜色转换" description="HEX / RGB / HSL 互转，带取色器">
      <div className="vc-panel">
        <div className="vc-tool-split" style={{ minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div
              className="vc-color-preview"
              style={{ background: rgb ? hex : 'var(--color-surface-elevated)' }}
            />
            <input
              className="vc-color-input"
              type="color"
              value={rgb ? hex : '#000000'}
              onChange={(e) => setHex(e.target.value)}
            />
          </div>

          <div className="vc-stack vc-stack--tight">
            <div>
              <div className="vc-field-label">HEX</div>
              <div className="vc-field-row">
                <Input className="vc-mono-input" value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#7C3AED" />
                <button className="vc-icon-btn" onClick={() => copy(hex)} aria-label="复制 HEX">
                  <Icon icon={copyIcon} width={16} />
                </button>
              </div>
            </div>
            <div>
              <div className="vc-field-label">RGB</div>
              <div className="vc-field-row">
                <Input className="vc-mono-input" readOnly value={rgbText} />
                <button className="vc-icon-btn" onClick={() => copy(rgbText)} aria-label="复制 RGB">
                  <Icon icon={copyIcon} width={16} />
                </button>
              </div>
            </div>
            <div>
              <div className="vc-field-label">HSL</div>
              <div className="vc-field-row">
                <Input className="vc-mono-input" readOnly value={hslText} />
                <button className="vc-icon-btn" onClick={() => copy(hslText)} aria-label="复制 HSL">
                  <Icon icon={copyIcon} width={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default ColorTool;
