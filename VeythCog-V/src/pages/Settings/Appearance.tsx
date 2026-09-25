import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Segmented, Switch } from 'antd';
import type { InputRef } from 'antd';
import { Icon } from '@iconify/react';
import sunIcon from '@iconify-icons/lucide/sun';
import moonIcon from '@iconify-icons/lucide/moon';
import monitorIcon from '@iconify-icons/lucide/monitor';
import glassIcon from '@iconify-icons/lucide/droplets';
import imageIcon from '@iconify-icons/lucide/image';
import checkIcon from '@iconify-icons/lucide/check';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { getPreset, presetNames } from '@/styles/presets';
import {
  BUILTIN_BACKGROUNDS,
  OVERLAY_STRENGTHS,
  parseBackground,
  type OverlayStrength,
} from '@/styles/backgrounds';
import type { AppearanceMode } from '@/types';

const AppearancePage: React.FC = () => {
  const { presetName, appearanceMode, isDark, setPreset, setAppearance, colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const setGlassEnabled = useSettingsStore((s) => s.setGlassEnabled);
  const background = useSettingsStore((s) => s.background);
  const setBackground = useSettingsStore((s) => s.setBackground);
  const overlayStrength = useSettingsStore((s) => s.overlayStrength);
  const setOverlayStrength = useSettingsStore((s) => s.setOverlayStrength);

  // 自定义 URL 输入
  const parsedBg = parseBackground(background);
  const [urlInput, setUrlInput] = useState(parsedBg.kind === 'url' ? (parsedBg.url ?? '') : '');
  const inputRef = useRef<InputRef>(null);

  // 背景切换时同步输入框（如在其它入口清空）
  useEffect(() => {
    if (parsedBg.kind === 'url') {
      setUrlInput(parsedBg.url ?? '');
    }
  }, [background]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyUrl = () => {
    const raw = (urlInput || '').trim();
    if (!raw) {
      inputRef.current?.focus();
      return;
    }
    // 仅接受 http(s) 或 data 链接，避免注入 CSS
    if (!/^(https?:\/\/|data:image\/)/i.test(raw)) {
      inputRef.current?.focus();
      return;
    }
    setBackground(`url:${raw}`);
  };

  const appearanceOptions: { label: React.ReactNode; value: AppearanceMode }[] = [
    {
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          <Icon icon={sunIcon} width={14} /> 亮色
        </span>
      ),
      value: 'light',
    },
    {
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          <Icon icon={moonIcon} width={14} /> 暗色
        </span>
      ),
      value: 'dark',
    },
    {
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          <Icon icon={monitorIcon} width={14} /> 系统
        </span>
      ),
      value: 'system',
    },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: '0 0 20px' }}>外观</h2>

      {/* 配色预设 */}
      <section
        className="glass-panel"
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={sectionTitle(colors)}>配色预设</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {presetNames.map((name) => {
            const preset = getPreset(name, isDark);
            const active = presetName === name;
            return (
              <div
                key={name}
                onClick={() => setPreset(name)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: preset.primary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: active ? `2px solid ${colors.text}` : '2px solid transparent',
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                  transition: `all 0.2s var(--spring)`,
                  boxShadow: active ? `0 0 0 4px ${preset.primary}30` : 'none',
                }}
                title={preset.label}
              >
                {active && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: colors.textTertiary }}>
          当前：{getPreset(presetName, isDark).label}
        </div>
      </section>

      {/* 外观模式 */}
      <section
        className="glass-panel"
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={sectionTitle(colors)}>外观模式</div>
        <Segmented
          value={appearanceMode}
          options={appearanceOptions}
          onChange={(val) => setAppearance(val as AppearanceMode)}
          block
        />
        <div style={{ marginTop: 10, fontSize: 13, color: colors.textTertiary }}>
          "系统"模式将跟随操作系统的亮暗设置自动切换。
        </div>
      </section>

      {/* 背景 */}
      <section
        className="glass-panel"
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div style={sectionTitle(colors)}>背景</div>

        {/* 内置图库 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {/* 默认（无背景） */}
          <BgCard
            active={parsedBg.kind === 'none'}
            label="默认"
            onClick={() => setBackground('none')}
            colors={colors}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 10,
                background: colors.bg,
                border: `1px dashed ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon icon={imageIcon} width={16} color={colors.textTertiary} />
            </div>
          </BgCard>

          {BUILTIN_BACKGROUNDS.map((bg) => {
            const active = parsedBg.kind === 'preset' && parsedBg.id === bg.id;
            const isImage = bg.type === 'image';
            const grad = isImage ? 'transparent' : `linear-gradient(135deg, ${bg.swatch[0]} 0%, ${bg.swatch[1]} 50%, ${bg.swatch[2]} 100%)`;
            return (
              <BgCard
                key={bg.id}
                active={active}
                label={bg.label}
                onClick={() => setBackground(`preset:${bg.id}`)}
                colors={colors}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 10,
                    backgroundImage: isImage ? `url(${bg.image})` : grad,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.35)',
                  }}
                />
              </BgCard>
            );
          })}
        </div>

        {/* 自定义图片 URL */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: 600 }}>
            自定义图片
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              ref={inputRef}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onPressEnter={applyUrl}
              placeholder="https://example.com/background.jpg"
              allowClear
              prefix={<Icon icon={imageIcon} width={14} color={colors.textTertiary} />}
            />
            <Button type="primary" onClick={applyUrl} style={{ minWidth: 76 }}>
              应用
            </Button>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: colors.textTertiary }}>
            支持 http(s) 或 data 链接；开启背景后建议开启上方"全局毛玻璃"以获得通透质感。
          </div>
        </div>

        {/* 遮罩强度（仅自定义图片生效） */}
        {parsedBg.kind === 'url' && (
          <div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: 600 }}>
              遮罩强度
            </div>
            <Segmented
              value={overlayStrength}
              options={OVERLAY_STRENGTHS.map((o) => ({ label: o.label, value: o.key }))}
              onChange={(val) => setOverlayStrength(val as OverlayStrength)}
              style={{ maxWidth: 240 }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: colors.textTertiary }}>
              调高可压暗图片，确保文字清晰可读。
            </div>
          </div>
        )}
      </section>

      {/* 全局毛玻璃 */}
      <section
        className="glass-panel"
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon icon={glassIcon} width={18} color={colors.textSecondary} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>全局毛玻璃</div>
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                卡片、弹层启用毛玻璃质感；输入框与按钮 hover 仅做边缘毛玻璃，避免文字发虚
              </div>
            </div>
          </div>
          <Switch checked={glassEnabled} onChange={setGlassEnabled} />
        </div>
      </section>
    </div>
  );
};

/** 内置背景缩略图卡片 */
function BgCard(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  colors: { text: string; border: string; surfaceElevated: string; textSecondary: string };
  children: React.ReactNode;
}) {
  const { active, label, onClick, colors } = props;
  return (
    <div
      onClick={onClick}
      title={label}
      style={{
        width: 80,
        height: 52,
        borderRadius: 12,
        padding: 3,
        position: 'relative',
        cursor: 'pointer',
        background: active ? colors.text : colors.border,
        transition: 'all 0.2s var(--spring)',
        transform: active ? 'scale(1.04)' : 'scale(1)',
        boxShadow: active ? `0 4px 14px ${colors.text}22` : 'none',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{props.children}</div>
      {active && (
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: 6,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: colors.text,
            color: colors.textSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Icon icon={checkIcon} width={10} color="#fff" />
        </div>
      )}
    </div>
  );
}

function sectionTitle(colors: { textSecondary: string }): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: 16,
    letterSpacing: 0.3,
  };
}

export default AppearancePage;
