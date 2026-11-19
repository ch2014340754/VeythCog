/**
 * 系统管理 · 系统配置
 *
 * 布局：页头（含撤销 / 保存）→「注册与公告」「新用户默认值」两张分组面板。
 * 表单统一走两列栅格：左侧标签列定宽、右侧控件列自适应并限宽（见 config.css），
 * 不再把标签和控件堆在纵向 .vc-setting-row 里、也不再给每个控件写死宽度。
 *
 * 视觉契约：docs/frontend-style-guide.md（颜色只取 --color-*，圆角/间距只用令牌，
 * 设置类子页页头关掉流光，加载/错误态都在内容卡内）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Select, Switch, message } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import { Icon } from '@iconify/react';
import checkIcon from '@iconify-icons/lucide/check';
import rotateIcon from '@iconify-icons/lucide/rotate-ccw';
import saveIcon from '@iconify-icons/lucide/save';
import { useTheme } from '@/contexts/ThemeContext';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/states/LoadingState';
import ErrorState from '@/components/states/ErrorState';
import { ModelModalityIcons, modelTypeMeta } from '@/components/ModelTypeTag';
import { getSystemConfig, saveSystemConfig } from '@/api/admin';
import { listAdminModels } from '@/api/adminModels';
import { getPreset, presetNames } from '@/styles/presets';
import type { SystemConfig, PresetName } from '@/types';
import './config.css';

/** 模型目录里可用于「默认模型」的可选项（只收已上架 + 可对话） */
interface ModelOption {
  value: string;
  vendor: string;
  vendorName: string;
  modelCode: string;
  modelName: string;
  modelType: string;
  modalities: string[];
}

const ANNOUNCEMENT_MAX = 200;

const ConfigPage: React.FC = () => {
  const { isDark } = useTheme();

  /** saved = 服务端已生效值；draft = 表单草稿。两者不同即「有未保存更改」 */
  const [saved, setSaved] = useState<SystemConfig | null>(null);
  const [draft, setDraft] = useState<SystemConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsFailed, setModelsFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getSystemConfig();
      setSaved(data);
      setDraft(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '加载系统配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 模型目录只为「默认模型」下拉提供选项；拿不到不阻断配置页本身 */
  useEffect(() => {
    let alive = true;
    listAdminModels()
      .then((list) => {
        if (!alive) {
          return;
        }
        const usable = list
          .filter((m) => m.enabled && modelTypeMeta(m.modelType).chatCapable)
          .map<ModelOption>((m) => ({
            value: `${m.vendor}:${m.modelCode}`,
            vendor: m.vendor,
            vendorName: m.vendorName,
            modelCode: m.modelCode,
            modelName: m.modelName,
            modelType: m.modelType,
            modalities: m.modalities?.length ? m.modalities : [m.modelType],
          }));
        setModels(usable);
        setModelsFailed(false);
      })
      .catch(() => {
        if (alive) {
          setModels([]);
          setModelsFailed(true);
        }
      })
      .finally(() => {
        if (alive) {
          setModelsLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const patch = (p: Partial<SystemConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  };

  const dirty = useMemo(() => {
    if (!saved || !draft) {
      return false;
    }
    return (
      saved.allowRegister !== draft.allowRegister ||
      saved.announcement !== draft.announcement ||
      saved.defaultPreset !== draft.defaultPreset ||
      saved.defaultVendor !== draft.defaultVendor ||
      saved.defaultModelCode !== draft.defaultModelCode
    );
  }, [saved, draft]);

  const onReset = () => {
    setDraft(saved);
  };

  const onSave = async () => {
    if (!draft) {
      return;
    }
    setSaving(true);
    try {
      await saveSystemConfig(draft);
      setSaved(draft);
      message.success('系统配置已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const currentModelValue = draft ? `${draft.defaultVendor}:${draft.defaultModelCode}` : '';
  const currentModelKnown = models.some((m) => m.value === currentModelValue);

  /** 下拉按供应商分组；目录里找不到当前值时补一个只读兜底项，避免显示成空 */
  const modelGroups = useMemo<DefaultOptionType[]>(() => {
    const groups = new Map<string, { label: string; options: { value: string; label: React.ReactNode }[] }>();
    models.forEach((m) => {
      const group = groups.get(m.vendor) ?? { label: m.vendorName, options: [] };
      group.options.push({
        value: m.value,
        label: (
          <span className="vc-config-model-opt">
            <ModelModalityIcons types={m.modalities} fallback={m.modelType} size={13} />
            <span className="vc-config-model-opt__name">{m.modelName}</span>
            <span className="vc-config-model-opt__code vc-mono">{m.modelCode}</span>
          </span>
        ),
      });
      groups.set(m.vendor, group);
    });
    if (draft && currentModelValue && !currentModelKnown) {
      return [
        ...Array.from(groups.values()),
        {
          label: '当前配置（未在目录中）',
          options: [
            {
              value: currentModelValue,
              label: `${draft.defaultVendor} / ${draft.defaultModelCode}`,
            },
          ],
        },
      ];
    }
    return Array.from(groups.values());
  }, [models, draft, currentModelValue, currentModelKnown]);

  const presetLabel = draft ? getPreset(draft.defaultPreset, isDark).label : '';

  return (
    <div className="vc-page">
      <div className="vc-page__body vc-config__body">
        {(saving || loading) && (
          <div className="vc-slim-progress">
            <div className="vc-slim-progress__bar" />
          </div>
        )}

        <PageHeader
          eyebrow="Admin / Config"
          title="系统配置"
          description="控制注册入口、首页公告，以及新用户注册时拿到的初始主题与默认模型；保存后立即对新会话生效。"
          flow={false}
          extra={
            draft ? (
              <div className="vc-config-actions">
                {dirty && <span className="vc-config-actions__dirty">有未保存的更改</span>}
                <Button
                  icon={<Icon icon={rotateIcon} width={15} />}
                  disabled={!dirty || saving}
                  onClick={onReset}
                >
                  撤销
                </Button>
                <Button
                  type="primary"
                  icon={<Icon icon={saveIcon} width={15} />}
                  loading={saving}
                  disabled={!dirty}
                  onClick={() => void onSave()}
                >
                  保存配置
                </Button>
              </div>
            ) : undefined
          }
        />

        {loading ? (
          <LoadingState tip="加载系统配置…" />
        ) : loadError || !draft ? (
          <ErrorState
            title="系统配置加载失败"
            message={loadError ?? '配置暂不可用，请稍后重试'}
            onRetry={() => void load()}
          />
        ) : (
          <div className="vc-config__stack">
            <section className="vc-panel" aria-labelledby="vc-config-access-title">
              <div className="vc-panel__head">
                <div>
                  <h2 className="vc-panel__title" id="vc-config-access-title">
                    注册与公告
                  </h2>
                  <p className="vc-panel__desc">决定谁能创建账号，以及所有用户首页顶部看到的那条公告。</p>
                </div>
                <span className="vc-meta">{draft.allowRegister ? '注册开放' : '注册关闭'}</span>
              </div>

              <div className="vc-config-form">
                <div className="vc-config-row">
                  <div className="vc-config-row__label">
                    <div className="vc-config-row__title">允许自助注册</div>
                    <div className="vc-config-row__desc">
                      关闭后注册页不再提供入口，只有管理员能在「用户管理」里建号。
                    </div>
                  </div>
                  <div className="vc-config-row__control">
                    <div className="vc-config-switch">
                      <Switch
                        checked={draft.allowRegister}
                        aria-label="允许自助注册"
                        onChange={(v) => patch({ allowRegister: v })}
                      />
                      <span className="vc-config-switch__state">
                        {draft.allowRegister ? '开启 · 任何人可自助注册' : '关闭 · 仅管理员创建账号'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="vc-config-row">
                  <div className="vc-config-row__label">
                    <div className="vc-config-row__title">系统公告</div>
                    <div className="vc-config-row__desc">
                      展示在所有用户首页顶部，支持换行；留空则不显示。
                    </div>
                  </div>
                  <div className="vc-config-row__control">
                    <Input.TextArea
                      value={draft.announcement}
                      placeholder="例如：本周六 02:00 进行数据库维护，期间对话可能中断。"
                      autoSize={{ minRows: 3, maxRows: 6 }}
                      maxLength={ANNOUNCEMENT_MAX}
                      showCount
                      aria-label="系统公告"
                      onChange={(e) => patch({ announcement: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="vc-panel" aria-labelledby="vc-config-default-title">
              <div className="vc-panel__head">
                <div>
                  <h2 className="vc-panel__title" id="vc-config-default-title">
                    新用户默认值
                  </h2>
                  <p className="vc-panel__desc">
                    用户注册完成时的初始外观与默认模型；之后仍可在「外观」和「模型配置」里各自调整。
                  </p>
                </div>
                <span className="vc-meta">
                  当前：{presetLabel} · {draft.defaultVendor} / {draft.defaultModelCode}
                </span>
              </div>

              <div className="vc-config-form">
                <div className="vc-config-row">
                  <div className="vc-config-row__label">
                    <div className="vc-config-row__title">默认主题</div>
                    <div className="vc-config-row__desc">
                      与「外观」页的配色预设同一套色板，亮暗两套随系统模式切换。
                    </div>
                  </div>
                  <div className="vc-config-row__control">
                    <div className="vc-config-presets" role="radiogroup" aria-label="新用户默认主题">
                      {presetNames.map((name) => {
                        const preset = getPreset(name, isDark);
                        const active = draft.defaultPreset === name;
                        return (
                          <div className="vc-theme-item" key={name}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={active}
                              aria-label={preset.label}
                              title={preset.label}
                              className={`vc-theme-swatch${active ? ' is-active' : ''}`}
                              style={{
                                background: preset.primary,
                                borderColor: active ? 'var(--color-text)' : 'transparent',
                              }}
                              onClick={() => patch({ defaultPreset: name as PresetName })}
                            >
                              {active && (
                                <Icon icon={checkIcon} width={16} color="var(--color-text-inverse)" />
                              )}
                              <span
                                className="vc-theme-swatch__accent"
                                style={{ background: preset.accent }}
                                aria-hidden
                              />
                            </button>
                            <span className={`vc-theme-name${active ? ' is-active' : ''}`}>
                              {preset.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="vc-config-row">
                  <div className="vc-config-row__label">
                    <div className="vc-config-row__title">默认模型</div>
                    <div className="vc-config-row__desc">
                      注册后自动绑定的对话模型；只列出「模型目录」里已上架且可对话的项。
                    </div>
                  </div>
                  <div className="vc-config-row__control">
                    <Select
                      value={currentModelValue || undefined}
                      loading={modelsLoading}
                      showSearch
                      aria-label="新用户默认模型"
                      placeholder="选择默认对话模型"
                      options={modelGroups}
                      filterOption={(input, option) => {
                        const model = models.find((m) => m.value === String(option?.value ?? ''));
                        const haystack = model
                          ? `${model.vendorName} ${model.modelName} ${model.modelCode}`
                          : String(option?.value ?? '');
                        return haystack.toLowerCase().includes(input.trim().toLowerCase());
                      }}
                      onChange={(value: string) => {
                        const [vendor, modelCode] = value.split(':');
                        patch({ defaultVendor: vendor, defaultModelCode: modelCode });
                      }}
                    />
                    {(modelsFailed || (!modelsLoading && models.length === 0)) && (
                      <div className="vc-hint">
                        模型目录暂不可用，只能保留当前默认模型。恢复后到「模型目录」页维护上架状态，再回到这里选择。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigPage;
