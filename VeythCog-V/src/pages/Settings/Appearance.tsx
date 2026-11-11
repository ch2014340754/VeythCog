import React, { useState } from 'react';
import { Button, Segmented, Slider, Switch } from 'antd';
import { Icon } from '@iconify/react';
import sunIcon from '@iconify-icons/lucide/sun';
import moonIcon from '@iconify-icons/lucide/moon';
import monitorIcon from '@iconify-icons/lucide/monitor';
import glassIcon from '@iconify-icons/lucide/droplets';
import imageIcon from '@iconify-icons/lucide/image';
import checkIcon from '@iconify-icons/lucide/check';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWallpaperStore } from '@/stores/wallpaperStore';
import WallpaperManagerModal from '@/components/WallpaperManagerModal';
import { getPreset, presetNames } from '@/styles/presets';
import {
  BUILTIN_BACKGROUNDS,
  parseBackground,
} from '@/styles/backgrounds';
import type { AppearanceMode } from '@/types';

const AppearancePage: React.FC = () => {
  const { presetName, appearanceMode, isDark, setPreset, setAppearance, colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const setGlassEnabled = useSettingsStore((s) => s.setGlassEnabled);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const setGlassOpacity = useSettingsStore((s) => s.setGlassOpacity);
  const background = useSettingsStore((s) => s.background);
  const setBackground = useSettingsStore((s) => s.setBackground);
  const overlayOpacity = useSettingsStore((s) => s.overlayOpacity);
  const setOverlayOpacity = useSettingsStore((s) => s.setOverlayOpacity);

  // 全站唯一壁纸（S3，与账号绑定）
  const activeWallpaper = useWallpaperStore((s) => s.active);
  const clearWallpaper = useWallpaperStore((s) => s.clear);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);

  const parsedBg = parseBackground(background);

  /** 选择纯色/渐变兜底：同时清空壁纸，避免两套背景并存 */
  const applyFallback = (id: string | null) => {
    setBackground(id ? `preset:${id}` : 'none');
    if (activeWallpaper) clearWallpaper();
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

        {/* 当前壁纸（全站唯一，与账号绑定） */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 120,
              height: 72,
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${colors.border}`,
              background: colors.surfaceElevated,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeWallpaper ? (
              activeWallpaper.kind === 'video' ? (
                <video
                  src={activeWallpaper.url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <img
                  src={activeWallpaper.url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )
            ) : (
              <span style={{ fontSize: 12, color: colors.textTertiary }}>纯色兜底</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
              {activeWallpaper
                ? activeWallpaper.kind === 'video' ? '动态壁纸' : '静态壁纸'
                : '未设置壁纸'}
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              全站共用一张壁纸，切换页面不会变化；选好后保存到你的账号
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button type="primary" onClick={() => setWallpaperOpen(true)}>
                壁纸管理
              </Button>
              {activeWallpaper && <Button onClick={() => clearWallpaper()}>清除壁纸</Button>}
            </div>
          </div>
        </div>

        {/* 纯色兜底 */}
        <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: 600 }}>
          纯色兜底
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {/* 默认（主题纯色） */}
          <BgCard
            active={parsedBg.kind === 'none' && !activeWallpaper}
            label="默认"
            onClick={() => applyFallback(null)}
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
            const active = parsedBg.kind === 'preset' && parsedBg.id === bg.id && !activeWallpaper;
            return (
              <BgCard
                key={bg.id}
                active={active}
                label={bg.label}
                onClick={() => applyFallback(bg.id)}
                colors={colors}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 10,
                    backgroundImage: `linear-gradient(135deg, ${bg.swatch[0]} 0%, ${bg.swatch[1]} 50%, ${bg.swatch[2]} 100%)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.35)',
                  }}
                />
              </BgCard>
            );
          })}
        </div>

        {/* 壁纸遮罩强度（0-100 连续可调） */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>壁纸遮罩强度</span>
            <span style={{ fontSize: 12, color: colors.textTertiary }}>{overlayOpacity}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            value={overlayOpacity}
            onChange={setOverlayOpacity}
            style={{ maxWidth: 320 }}
          />
          <div style={{ marginTop: 4, fontSize: 12, color: colors.textTertiary }}>
            0 为完全不加遮罩；调高可压暗壁纸，确保文字清晰可读，对静态与动态壁纸都生效。
          </div>
        </div>
      </section>

      <WallpaperManagerModal open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} />

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
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>面板玻璃朦胧感</span>
            <span style={{ fontSize: 12, color: colors.textTertiary }}>{glassOpacity}%</span>
          </div>
          <Slider
            min={0}
            max={90}
            value={glassOpacity}
            onChange={setGlassOpacity}
            style={{ maxWidth: 320 }}
          />
          <div style={{ marginTop: 4, fontSize: 12, color: colors.textTertiary }}>
            往左拖背景图越清晰，往右拖毛玻璃感越明显，背景始终隐约透出。
          </div>
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
