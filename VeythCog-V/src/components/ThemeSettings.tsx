import React from 'react';
import { Popover, Segmented } from 'antd';
import { Icon } from '@iconify/react';
import sunIcon from '@iconify-icons/lucide/sun';
import moonIcon from '@iconify-icons/lucide/moon';
import monitorIcon from '@iconify-icons/lucide/monitor';
import paletteIcon from '@iconify-icons/lucide/palette';
import { useTheme } from '@/contexts/ThemeContext';
import { getPreset, presetNames } from '@/styles/presets';
import type { PresetName, AppearanceMode } from '@/types';

const ThemeSettings: React.FC = () => {
  const { presetName, appearanceMode, isDark, setPreset, setAppearance, colors } = useTheme();

  const appearanceOptions: { label: React.ReactNode; value: AppearanceMode }[] = [
    {
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <Icon icon={sunIcon} width={14} />
          亮色
        </span>
      ),
      value: 'light',
    },
    {
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <Icon icon={moonIcon} width={14} />
          暗色
        </span>
      ),
      value: 'dark',
    },
    {
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <Icon icon={monitorIcon} width={14} />
          系统
        </span>
      ),
      value: 'system',
    },
  ];

  const presetContent = (
    <div style={{ width: 240, padding: '8px 0' }}>
      {/* 配色预设 */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.textSecondary,
            marginBottom: 8,
            letterSpacing: 0.5,
          }}
        >
          配色预设
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presetNames.map((name) => {
            const preset = getPreset(name, isDark);
            const isActive = presetName === name;
            return (
              <div
                key={name}
                onClick={() => setPreset(name)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: preset.primary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isActive
                    ? `2px solid ${colors.text}`
                    : '2px solid transparent',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: `all 0.2s var(--spring)`,
                  boxShadow: isActive
                    ? `0 0 0 3px ${preset.primary}30`
                    : 'none',
                  position: 'relative',
                }}
                title={preset.label}
              >
                {isActive && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#ffffff',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: colors.textTertiary,
          }}
        >
          {getPreset(presetName, isDark).label}
        </div>
      </div>

      {/* 外观模式 */}
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.textSecondary,
            marginBottom: 8,
            letterSpacing: 0.5,
          }}
        >
          外观模式
        </div>
        <Segmented
          value={appearanceMode}
          options={appearanceOptions}
          onChange={(val) => setAppearance(val as AppearanceMode)}
          block
        />
      </div>
    </div>
  );

  return (
    <Popover
      content={presetContent}
      trigger="click"
      placement="rightTop"
      arrow={false}
      overlayStyle={{
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: `all 0.2s var(--spring)`,
          background: colors.primary10,
          color: colors.primary,
        }}
        title="主题设置"
      >
        <Icon icon={paletteIcon} width={18} />
      </div>
    </Popover>
  );
};

export default ThemeSettings;