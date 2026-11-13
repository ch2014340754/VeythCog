import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Empty, Input, message, Modal, Select, Spin, Tag, Tooltip } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  batchBindModels,
  clearVendorKey,
  getCatalog,
  verifyModel,
} from '@/api/llm';
import type { CatalogVendorItem } from '@/types';
import { ModelModalityTags } from '@/components/ModelTypeTag';

/** 供应商卡片上的编辑草稿（前端本地状态，保存时整体提交） */
interface VendorDraft {
  selected: string[];
  keyDraft: string;
  /** 业务空间草稿（仅百炼） */
  workspaceDraft: string;
  /** 地域草稿（仅百炼） */
  regionDraft: string;
  defaultCode?: string;
  saving: boolean;
  clearing: boolean;
  /** 正在校验的模型编码；空表示没有进行中的校验 */
  verifyingCode?: string;
}

function buildDraft(v: CatalogVendorItem): VendorDraft {
  return {
    selected: v.models.filter((m) => m.bound).map((m) => m.modelCode),
    keyDraft: '',
    workspaceDraft: v.workspaceId ?? '',
    regionDraft: v.region ?? '',
    defaultCode: v.models.find((m) => m.isDefault)?.modelCode,
    saving: false,
    clearing: false,
    verifyingCode: undefined,
  };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/** 顶部 2px 细进度条（保存时使用，不遮挡内容） */
const SlimProgress: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      overflow: 'hidden',
      pointerEvents: 'none',
      borderTopLeftRadius: 'var(--radius-lg)',
      borderTopRightRadius: 'var(--radius-lg)',
    }}
  >
    <div
      style={{
        width: '45%',
        height: '100%',
        borderRadius: 2,
        background: 'var(--color-primary, #7C3AED)',
        animation: 'vc-slim-progress 1.1s ease-in-out infinite',
      }}
    />
  </div>
);

const ProvidersPage: React.FC = () => {
  const { colors } = useTheme();
  const loadModels = useSettingsStore((s) => s.loadModels);
  const [catalog, setCatalog] = useState<CatalogVendorItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, VendorDraft>>({});
  const [loading, setLoading] = useState(true);

  /** silent=true：保留当前内容，仅静默更新数据（无感刷新） */
  const load = async (silent = false): Promise<CatalogVendorItem[]> => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const data = await getCatalog();
      setCatalog(data);
      setDrafts((prev) => {
        const next: Record<string, VendorDraft> = {};
        for (const v of data) {
          next[v.vendor] = prev[v.vendor] ?? buildDraft(v);
        }
        return next;
      });
      return data;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = (vendor: string, p: Partial<VendorDraft>) => {
    setDrafts((prev) => (prev[vendor] ? { ...prev, [vendor]: { ...prev[vendor], ...p } } : prev));
  };

  /** 保存：多选模型 + 可选新 AK + 默认模型 + 百炼业务空间，一次提交 */
  const doSave = async (v: CatalogVendorItem, d: VendorDraft) => {
    const apiKey = d.keyDraft.trim();
    patch(v.vendor, { saving: true });
    const isDashScope = v.vendor === 'dashscope';
    try {
      await batchBindModels({
        vendor: v.vendor,
        modelCodes: d.selected,
        apiKey: apiKey || undefined,
        defaultModelCode: d.selected.length ? d.defaultCode : undefined,
        ...(isDashScope
          ? { workspaceId: d.workspaceDraft.trim(), region: d.regionDraft.trim() }
          : {}),
      });
      const data = await load(true);
      const fresh = data.find((x) => x.vendor === v.vendor);
      if (fresh) {
        patch(v.vendor, buildDraft(fresh));
      }
      await loadModels();
      message.success(apiKey ? '已保存模型与 API Key' : '已保存模型配置');
    } catch (e) {
      patch(v.vendor, { saving: false });
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const save = (v: CatalogVendorItem) => {
    const d = drafts[v.vendor];
    if (!d) {
      return;
    }
    if (d.selected.length === 0) {
      Modal.confirm({
        title: '解绑该供应商下的全部模型？',
        content: '保存后将移除全部绑定；用户 AK 随绑定行一并清除，之后回落到系统兜底。',
        okText: '确认解绑',
        okButtonProps: { danger: true },
        onOk: () => doSave(v, d),
      });
      return;
    }
    void doSave(v, d);
  };

  /** 清除用户 AK，回落到系统兜底 */
  const clearKey = async (v: CatalogVendorItem) => {
    patch(v.vendor, { clearing: true });
    try {
      await clearVendorKey(v.vendor);
      const data = await load(true);
      const fresh = data.find((x) => x.vendor === v.vendor);
      if (fresh) {
        patch(v.vendor, buildDraft(fresh));
      }
      await loadModels();
      if (v.hasFallbackKey) {
        message.success('已清除用户 AK，将使用系统兜底');
      } else {
        message.warning('已清除用户 AK；该系统未配置兜底 AK，对话会提示未配置密钥');
      }
    } catch (e) {
      patch(v.vendor, { clearing: false });
      message.error(e instanceof Error ? e.message : '清除失败');
    }
  };

  /** 校验单个模型：不要求先绑定；优先用当前草稿 AK，其次已保存 AK / 系统兜底 */
  const verifyOne = async (
    v: CatalogVendorItem,
    d: VendorDraft,
    modelCode: string,
    modelName: string
  ) => {
    patch(v.vendor, { verifyingCode: modelCode });
    try {
      const r = await verifyModel(
        v.vendor,
        modelCode,
        d.keyDraft.trim() || undefined,
        v.vendor === 'dashscope' ? d.workspaceDraft.trim() || undefined : undefined,
        v.vendor === 'dashscope' ? d.regionDraft.trim() || undefined : undefined
      );
      if (r.valid) {
        message.success(`${modelName} 校验通过，可勾选后保存绑定`);
      } else {
        Modal.warning({
          title: `${modelName} 校验未通过`,
          content: (
            <div style={{ fontSize: 13 }}>
              <div>{r.message}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
                修正 Key / 额度后重新点该行「校验」即可。
              </div>
            </div>
          ),
        });
      }
      const data = await load(true);
      const fresh = data.find((x) => x.vendor === v.vendor);
      if (fresh) {
        setDrafts((prev) => {
          const current = prev[v.vendor];
          const rebuilt = buildDraft(fresh);
          // 保留用户尚未保存的勾选与 AK 草稿，避免校验一次就丢失编辑状态
          return {
            ...prev,
            [v.vendor]: current
              ? {
                  ...rebuilt,
                  selected: current.selected,
                  keyDraft: current.keyDraft,
                  defaultCode: current.defaultCode,
                  workspaceDraft: current.workspaceDraft,
                  regionDraft: current.regionDraft,
                }
              : rebuilt,
          };
        });
      }
      await loadModels();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '校验失败');
    } finally {
      patch(v.vendor, { verifyingCode: undefined });
    }
  };

  const statusTag = (v: CatalogVendorItem) => {
    if (v.hasApiKey) {
      return <Tag color="green" style={{ marginInlineEnd: 0 }}>用户 AK</Tag>;
    }
    if (v.hasFallbackKey) {
      return <Tag color="blue" style={{ marginInlineEnd: 0 }}>系统兜底</Tag>;
    }
    return <Tag color="orange" style={{ marginInlineEnd: 0 }}>未配置</Tag>;
  };

  const renderCard = (v: CatalogVendorItem) => {
    const d = drafts[v.vendor];
    if (!d) {
      return null;
    }
    const boundCodes = v.models.filter((m) => m.bound).map((m) => m.modelCode);
    const serverDefault = v.models.find((m) => m.isDefault)?.modelCode;
    const selectedChanged = !sameSet(d.selected, boundCodes);
    const defaultChanged =
      d.selected.length > 0 && (d.defaultCode ?? undefined) !== (serverDefault ?? undefined);
    const workspaceChanged =
      v.vendor === 'dashscope' &&
      (d.workspaceDraft.trim() !== (v.workspaceId ?? '') ||
        d.regionDraft.trim() !== (v.region ?? ''));
    const dirty = selectedChanged || d.keyDraft.trim() !== '' || defaultChanged || workspaceChanged;
    const busy = d.saving || d.clearing || Boolean(d.verifyingCode);
    const keyPlaceholder = v.hasApiKey
      ? `已配置：${v.apiKeyMasked ?? '****'}（留空则不修改）`
      : v.hasFallbackKey
        ? '当前使用系统兜底 AK；填入则改用你自己的 Key'
        : '未配置 AK，请填入你的 Key';
    const defaultOptions = v.models
      .filter((m) => d.selected.includes(m.modelCode))
      .map((m) => ({ label: `${m.modelName}（${m.modelCode}）`, value: m.modelCode }));

    return (
      <div
        key={v.vendor}
        className="glass-panel"
        style={{
          position: 'relative',
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 20,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        {busy && <SlimProgress />}

        {/* 供应商头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{v.vendorName}</span>
            <Tag color="default" style={{ marginInlineEnd: 0 }}>{v.vendor}</Tag>
            {statusTag(v)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(v.effectiveBaseUrl || v.baseUrl) && (
              <Tooltip title={v.effectiveBaseUrl || v.baseUrl}>
                <span
                  style={{
                    fontSize: 12,
                    color: colors.textTertiary,
                    maxWidth: 360,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {v.effectiveBaseUrl || v.baseUrl}
                </span>
              </Tooltip>
            )}
          </div>
        </div>

        {/* API Key */}
        <div
          style={{
            border: `1px solid ${colors.divider}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: 16,
            background: colors.primary10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>API Key</span>
            <span style={{ fontSize: 12, color: colors.textTertiary }}>
              仅加密保存到你的账号下；同一供应商下的模型共用一把 Key
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Input.Password
              value={d.keyDraft}
              onChange={(e) => patch(v.vendor, { keyDraft: e.target.value })}
              placeholder={keyPlaceholder}
              autoComplete="new-password"
              spellCheck={false}
              disabled={busy}
              style={{ flex: 1 }}
            />
            {v.hasApiKey && (
              <Button size="small" danger type="link" loading={d.clearing} onClick={() => void clearKey(v)}>
                清除我的 AK
              </Button>
            )}
          </div>
        </div>

        {/* 百炼地域 / 业务空间（与 AK 同级：同一供应商共用） */}
        {v.vendor === 'dashscope' && (
          <div
            style={{
              border: `1px solid ${colors.divider}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: 16,
              background: colors.primary10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                业务空间 / 地域
              </span>
              <span style={{ fontSize: 12, color: colors.textTertiary }}>
                留空回落系统配置；配置后调用专属域名，适配工作空间模型与地域隔离
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Input
                value={d.workspaceDraft}
                onChange={(e) => patch(v.vendor, { workspaceDraft: e.target.value })}
                placeholder={
                  v.hasFallbackWorkspace && v.effectiveWorkspaceId
                    ? `系统兜底：${v.effectiveWorkspaceId}`
                    : '业务空间 ID，如 llm-j09pwqdqv4no16ww；留空走标准域名'
                }
                disabled={busy}
                spellCheck={false}
                style={{ flex: 1 }}
              />
              <Input
                value={d.regionDraft}
                onChange={(e) => patch(v.vendor, { regionDraft: e.target.value })}
                placeholder={`地域，默认 ${v.effectiveRegion || 'cn-beijing'}`}
                disabled={busy}
                spellCheck={false}
                style={{ width: 200 }}
              />
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
              当前调用：{v.effectiveBaseUrl || v.baseUrl}
              {v.hasFallbackWorkspace && !v.workspaceId ? '（系统兜底业务空间）' : ''}
            </div>
          </div>
        )}

        {/* 模型多选 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
            可用模型（多选）
          </div>
          <Checkbox.Group
            value={d.selected}
            disabled={busy}
            style={{ display: 'block' }}
            onChange={(vals) => {
              const selected = (vals as unknown as string[]).map(String);
              const nextDefault =
                d.defaultCode && selected.includes(d.defaultCode) ? d.defaultCode : undefined;
              patch(v.vendor, { selected, defaultCode: nextDefault });
            }}
          >
            {v.models.map((m) => (
              <div
                key={m.modelCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: `1px solid ${colors.divider}`,
                }}
              >
                <Checkbox value={m.modelCode} disabled={!m.enabled || busy}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, color: colors.text, fontWeight: 500 }}>{m.modelName}</span>
                    <ModelModalityTags types={m.modalities} fallback={m.modelType} compact />
                    <span style={{ fontSize: 12, color: colors.textTertiary }}>{m.modelCode}</span>
                  </span>
                </Checkbox>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m.valid && (
                    <Tag color="green" style={{ marginInlineEnd: 0 }}>
                      {m.bound ? '已验证' : '已验证 · 待绑定'}
                    </Tag>
                  )}
                  {!m.valid && m.bound && (
                    <Tooltip title={m.verifyError || '尚未通过连通校验，不会出现在对话页'}>
                      <Tag color="orange" style={{ marginInlineEnd: 0 }}>未校验</Tag>
                    </Tooltip>
                  )}
                  {!m.valid && !m.bound && m.verifyError && (
                    <Tooltip title={m.verifyError}>
                      <Tag color="red" style={{ marginInlineEnd: 0 }}>校验失败</Tag>
                    </Tooltip>
                  )}
                  {m.isDefault && (
                    <Tag color="gold" style={{ marginInlineEnd: 0 }}>当前默认</Tag>
                  )}
                  <Button
                    type="link"
                    size="small"
                    style={{ paddingInline: 4, height: 22, fontSize: 12 }}
                    loading={d.verifyingCode === m.modelCode}
                    disabled={!m.enabled || busy}
                    onClick={() => void verifyOne(v, d, m.modelCode, m.modelName)}
                  >
                    校验
                  </Button>
                </div>
              </div>
            ))}
          </Checkbox.Group>
        </div>

        {/* 默认模型 + 保存 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: colors.textSecondary }}>默认模型</span>
            <Select
              size="small"
              style={{ minWidth: 220 }}
              placeholder="未选择则取第一个"
              value={d.defaultCode}
              options={defaultOptions}
              disabled={busy || d.selected.length === 0}
              allowClear
              onChange={(val) => patch(v.vendor, { defaultCode: val })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: colors.textTertiary }}>
              已选 {d.selected.length}/{v.models.length}
            </span>
            <Button
              type="primary"
              size="small"
              loading={d.saving}
              disabled={!dirty || busy}
              onClick={() => void save(v)}
            >
              保存
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>模型配置</h2>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            选择供应商 → 填写你自己的 API Key（加密保存）→ 逐行点「校验」；校验通过后再勾选要用的模型并保存。
            校验不要求先绑定，未填 AK 时用已保存 AK 或系统兜底；只有通过校验的对话模型会出现在对话页
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spin />
        </div>
      ) : catalog.length === 0 ? (
        <Empty description="暂无可用供应商" style={{ marginTop: 80 }} />
      ) : (
        catalog.map(renderCard)
      )}

      <div
        style={{
          marginTop: 16,
          fontSize: 12,
          color: colors.textTertiary,
          background: colors.primary10,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
        }}
      >
        提示：API Key 使用 AES-256-GCM 加密后存储在 `user_llm_binding`，同一供应商下的模型共用一把 Key；
        校验结论按「用户 + 模型 + Key 指纹」记录在 `user_llm_model_verify`，修改或清除 AK 后自动失效；
        清除 AK 后自动回落到后端配置文件中的 AK。
      </div>
    </div>
  );
};

export default ProvidersPage;
