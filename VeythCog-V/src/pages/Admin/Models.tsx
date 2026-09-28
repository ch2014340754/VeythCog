import React, { useEffect, useState } from 'react';
import { Switch, Tag, message, Empty } from 'antd';
import { Icon } from '@iconify/react';
import starIcon from '@iconify-icons/lucide/star';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getVendorCatalog,
  updateVendorVisibility,
  updateModelVisibility,
  setDefaultModel,
} from '@/api/admin';
import type { AdminVendor } from '@/types';

const ModelsPage: React.FC = () => {
  const { colors } = useTheme();
  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getVendorCatalog();
    setVendors(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onVendorToggle = async (v: AdminVendor, visible: boolean) => {
    await updateVendorVisibility(v.vendor, visible);
    message.success(`${v.vendorName} ${visible ? '已对用户开放' : '已隐藏'}`);
    void load();
  };

  const onModelToggle = async (v: AdminVendor, modelCode: string, visible: boolean) => {
    await updateModelVisibility(v.vendor, modelCode, visible);
    void load();
  };

  const onSetDefault = async (v: AdminVendor, modelCode: string) => {
    await setDefaultModel(v.vendor, modelCode);
    message.success('已设为新用户默认模型');
    void load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>加载中…</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>模型目录</h2>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
          控制用户可见的供应商和模型。用户自行管理 API Key，你只决定"能选什么"。
        </p>
      </div>

      {vendors.map((v) => (
        <section
          key={v.vendor}
          style={{
            background: colors.surface,
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${colors.border}`,
            padding: 20,
            marginBottom: 16,
          }}
        >
          {/* 供应商头 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{v.vendorName}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{v.baseUrl}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: colors.textSecondary }}>对用户可见</span>
              <Switch checked={v.visible} onChange={(val) => onVendorToggle(v, val)} />
            </div>
          </div>

          {/* 模型列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.models.map((m) => (
              <div
                key={m.modelCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: v.visible ? (m.visible ? colors.primary10 : 'transparent') : colors.textTertiary15,
                  opacity: v.visible ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.modelName}</span>
                  <span style={{ fontSize: 11, color: colors.textTertiary }}>{m.modelCode}</span>
                  {m.isDefault && (
                    <Tag color="gold" icon={<Icon icon={starIcon} width={10} />}>
                      默认
                    </Tag>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {!m.isDefault && v.visible && (
                    <a
                      onClick={() => onSetDefault(v, m.modelCode)}
                      style={{ fontSize: 12, cursor: 'pointer', color: colors.textSecondary }}
                    >
                      设为默认
                    </a>
                  )}
                  <Switch
                    size="small"
                    checked={m.visible}
                    disabled={!v.visible}
                    onChange={(val) => onModelToggle(v, m.modelCode, val)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {vendors.length === 0 && <Empty description="暂无供应商配置" />}
    </div>
  );
};

export default ModelsPage;
