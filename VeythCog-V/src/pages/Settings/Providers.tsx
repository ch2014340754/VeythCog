import React, { useEffect, useState } from 'react';
import { Button, Switch, message, Empty, Spin, Tag } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';
import { getCatalog, bindModel, unbindModel, setDefaultModel } from '@/api/llm';
import type { CatalogVendorItem } from '@/types';

/** 模型唯一 id */
function mid(vendor: string, modelCode: string): string {
  return `${vendor}:${modelCode}`;
}

const ProvidersPage: React.FC = () => {
  const { colors } = useTheme();
  const loadModels = useSettingsStore((s) => s.loadModels);
  const [catalog, setCatalog] = useState<CatalogVendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setCatalog(await getCatalog());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 绑定 / 解绑 */
  const toggleBind = async (vendor: string, modelCode: string, bound: boolean) => {
    setBusy(mid(vendor, modelCode));
    try {
      if (bound) {
        await unbindModel(vendor, modelCode);
        message.success('已解绑模型');
      } else {
        await bindModel(vendor, modelCode);
        message.success('已绑定模型');
      }
      await load(); // 刷新目录
      await loadModels(); // 同步设置里的我的绑定 + 默认模型
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  /** 设为默认 */
  const makeDefault = async (vendor: string, modelCode: string) => {
    setBusy(mid(vendor, modelCode));
    try {
      await setDefaultModel(vendor, modelCode);
      message.success('已设为默认模型');
      await load();
      await loadModels();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>模型配置</h2>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            勾选绑定你想使用的模型；绑定后可设为默认，登录后对话页自动选中默认模型
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
        catalog.map((vendor) => (
          <div
            key={vendor.vendor}
            className="glass-panel"
            style={{
              background: colors.surface,
              borderRadius: 'var(--radius-lg)',
              border: `1px solid ${colors.border}`,
              padding: 20,
              marginBottom: 16,
            }}
          >
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
                <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>
                  {vendor.vendorName}
                </span>
                <Tag color="default" style={{ marginInlineEnd: 0 }}>
                  {vendor.vendor}
                </Tag>
              </div>
              {vendor.baseUrl && (
                <span style={{ fontSize: 12, color: colors.textTertiary }}>{vendor.baseUrl}</span>
              )}
            </div>

            {/* 模型列表 */}
            {vendor.models.map((m) => (
              <div
                key={m.modelCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: `1px solid ${colors.divider}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: colors.text, fontWeight: 500 }}>
                    {m.modelName}
                  </span>
                  <span style={{ fontSize: 12, color: colors.textTertiary }}>{m.modelCode}</span>
                  {m.isDefault && (
                    <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                      默认
                    </Tag>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {m.bound && !m.isDefault && (
                    <Button
                      size="small"
                      type="link"
                      loading={busy === mid(vendor.vendor, m.modelCode)}
                      onClick={() => makeDefault(vendor.vendor, m.modelCode)}
                    >
                      设为默认
                    </Button>
                  )}
                  <Switch
                    size="small"
                    checked={m.bound}
                    loading={busy === mid(vendor.vendor, m.modelCode)}
                    onChange={(checked) => toggleBind(vendor.vendor, m.modelCode, m.bound)}
                  />
                </div>
              </div>
            ))}
          </div>
        ))
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
        提示：供应商 API Key 由后端统一管理（当前在配置文件，后续迁移 Nacos）。前端只负责选择已绑定的模型。
      </div>
    </div>
  );
};

export default ProvidersPage;
