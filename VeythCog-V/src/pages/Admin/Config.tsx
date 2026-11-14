import React, { useEffect, useState } from 'react';
import { Switch, Input, Select, Button, message } from 'antd';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/states/LoadingState';
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
    try {
      await saveSystemConfig(cfg);
      message.success('系统配置已保存');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) {
    return (
      <div className="vc-page">
        <div className="vc-page__body">
          <PageHeader eyebrow="Admin / Config" title="系统配置" description="全局行为和新用户默认偏好。" />
          <LoadingState tip="加载系统配置…" />
        </div>
      </div>
    );
  }

  return (
    <div className="vc-page">
      <div className="vc-page__body" style={{ maxWidth: 760 }}>
        <PageHeader
          eyebrow="Admin / Config"
          title="系统配置"
          description="全局行为与新用户默认偏好，保存后立即对新会话生效。"
        />

        <section className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">注册与默认值</h2>
              <p className="vc-panel__desc">控制注册入口、首页公告以及新用户初始主题与模型。</p>
            </div>
          </div>

          <div className="vc-setting-row">
            <div className="vc-setting-row__label">
              <div className="vc-setting-row__title">允许自助注册</div>
              <div className="vc-hint">关闭后只有管理员能创建新用户</div>
            </div>
            <Switch checked={cfg.allowRegister} onChange={(v) => setCfg({ ...cfg, allowRegister: v })} />
          </div>

          <div className="vc-setting-row">
            <div className="vc-setting-row__label">
              <div className="vc-setting-row__title">系统公告</div>
              <div className="vc-hint">展示在所有用户首页顶部，留空则不显示</div>
            </div>
            <Input
              style={{ width: 300 }}
              placeholder="输入公告内容…"
              value={cfg.announcement}
              onChange={(e) => setCfg({ ...cfg, announcement: e.target.value })}
            />
          </div>

          <div className="vc-setting-row">
            <div className="vc-setting-row__label">
              <div className="vc-setting-row__title">新用户默认主题</div>
              <div className="vc-hint">注册后默认使用的配色预设</div>
            </div>
            <Select
              style={{ width: 180 }}
              value={cfg.defaultPreset}
              options={PRESET_OPTIONS}
              onChange={(v: PresetName) => setCfg({ ...cfg, defaultPreset: v })}
            />
          </div>

          <div className="vc-setting-row">
            <div className="vc-setting-row__label">
              <div className="vc-setting-row__title">新用户默认模型</div>
              <div className="vc-hint">新用户注册后自动绑定的模型（需先在模型目录中开放）</div>
            </div>
            <Select
              style={{ width: 240 }}
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
          </div>
        </section>

        <div className="vc-actions">
          <Button type="primary" loading={saving} onClick={onSave}>
            保存配置
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfigPage;
