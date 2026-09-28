import React, { useEffect, useState } from 'react';
import { Switch, Input, Select, Button, message } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { getSystemConfig, saveSystemConfig } from '@/api/admin';
import type { SystemConfig, PresetName } from '@/types';

const PRESET_OPTIONS = [
  { value: 'amethyst', label: '紫晶' },
  { value: 'amber', label: '琥珀' },
  { value: 'emerald', label: '翡翠' },
  { value: 'indigo', label: '靛蓝' },
  { value: 'rose', label: '玫瑰' },
  { value: 'slate', label: '石墨' },
];

const ConfigPage: React.FC = () => {
  const { colors } = useTheme();
  const [cfg, setCfg] = useState<SystemConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await getSystemConfig();
    setCfg(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const onSave = async () => {
    if (!cfg) return;
    setSaving(true);
    await saveSystemConfig(cfg);
    setSaving(false);
    message.success('系统配置已保存');
  };

  if (!cfg) return <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>加载中…</div>;

  const Row: React.FC<{ label: string; desc: string; children: React.ReactNode }> = ({ label, desc, children }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, padding: '16px 0', borderBottom: `1px solid ${colors.divider}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>系统配置</h2>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
          全局行为和新用户默认偏好
        </p>
      </div>

      <section
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: '8px 24px 16px',
        }}
      >
        <Row label="允许自助注册" desc="关闭后只有管理员能创建新用户">
          <Switch checked={cfg.allowRegister} onChange={(v) => setCfg({ ...cfg, allowRegister: v })} />
        </Row>

        <Row label="系统公告" desc="展示在所有用户首页顶部，留空则不显示">
          <Input
            style={{ width: 300 }}
            placeholder="输入公告内容…"
            value={cfg.announcement}
            onChange={(e) => setCfg({ ...cfg, announcement: e.target.value })}
          />
        </Row>

        <Row label="新用户默认主题" desc="注册后默认使用的配色预设">
          <Select
            style={{ width: 160 }}
            value={cfg.defaultPreset}
            options={PRESET_OPTIONS}
            onChange={(v: PresetName) => setCfg({ ...cfg, defaultPreset: v })}
          />
        </Row>

        <Row label="新用户默认模型" desc="新用户注册后自动绑定的模型（需先在模型目录中开放）">
          <Select
            style={{ width: 220 }}
            value={`${cfg.defaultVendor}:${cfg.defaultModelCode}`}
            options={[
              { value: 'dashscope:qwen-plus', label: 'DashScope / Qwen Plus' },
              { value: 'dashscope:qwen-turbo', label: 'DashScope / Qwen Turbo' },
              { value: 'deepseek:deepseek-chat', label: 'DeepSeek / V3' },
              { value: 'deepseek:deepseek-reasoner', label: 'DeepSeek / R1' },
            ]}
            onChange={(v: string) => {
              const [vendor, modelCode] = v.split(':');
              setCfg({ ...cfg, defaultVendor: vendor, defaultModelCode: modelCode });
            }}
          />
        </Row>
      </section>

      <div style={{ marginTop: 20 }}>
        <Button type="primary" loading={saving} onClick={onSave}>
          保存配置
        </Button>
      </div>
    </div>
  );
};

export default ConfigPage;
