import React from 'react';
import { Segmented, Switch } from 'antd';
import { Icon } from '@iconify/react';
import sunIcon from '@iconify-icons/lucide/sun';
import moonIcon from '@iconify-icons/lucide/moon';
import monitorIcon from '@iconify-icons/lucide/monitor';
import glassIcon from '@iconify-icons/lucide/droplets';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { getPreset, presetNames } from '@/styles/presets';
import type { AppearanceMode } from '@/types';

const AppearancePage: React.FC = () => {
  const { presetName, appearanceMode, isDark, setPreset, setAppearance, colors } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const setGlassEnabled = useSettingsStore((s) => s.setGlassEnabled);

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
