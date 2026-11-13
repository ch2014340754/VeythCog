import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import plusIcon from '@iconify-icons/lucide/plus';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import editIcon from '@iconify-icons/lucide/pencil';
import trashIcon from '@iconify-icons/lucide/trash-2';
import databaseIcon from '@iconify-icons/lucide/database';
import searchIcon from '@iconify-icons/lucide/search';
import { useTheme } from '@/contexts/ThemeContext';
import {
  createAdminModel,
  deleteAdminModel,
  listAdminModels,
  listModelVendors,
  setAdminModelEnabled,
  syncVendorModels,
  updateAdminModel,
} from '@/api/adminModels';
import type { AdminLlmModel, ModelVendorOption } from '@/api/adminModels';
import { MODEL_TYPE_OPTIONS, ModelModalityTags } from '@/components/ModelTypeTag';

/** 顶部 2px 细进度条（静默刷新时使用，不遮挡内容） */
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

const ModelsPage: React.FC = () => {
  const { colors } = useTheme();

  const [rows, setRows] = useState<AdminLlmModel[]>([]);
  const [vendors, setVendors] = useState<ModelVendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'on' | 'off'>('all');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');

  /** 表格可视高度：撑满父容器剩余空间，超出后表头固定、表体内部滚动（虚拟渲染，不再分页） */
  const [bodyHeight, setBodyHeight] = useState(400);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  // 新增 / 编辑
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLlmModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 同步
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncVendor, setSyncVendor] = useState('dashscope');
  const [syncEnableNew, setSyncEnableNew] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const vendorsRef = useRef<ModelVendorOption[]>([]);

  /** silent=true 时只显示细进度条，不清空当前内容 */
  const load = async (silent = false) => {
    if (silent) {
      setBusy(true);
    } else {
      setLoading(true);
    }
    try {
      const [list, vendorOptions] = await Promise.all([
        listAdminModels(),
        vendorsRef.current.length ? Promise.resolve(vendorsRef.current) : listModelVendors(),
      ]);
      setRows(list);
      if (!vendorsRef.current.length) {
        vendorsRef.current = vendorOptions;
        setVendors(vendorOptions);
        setSyncVendor(vendorOptions[0]?.vendor ?? 'dashscope');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载模型目录失败');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(
    () => ({
      all: rows.length,
      on: rows.filter((r) => r.enabled).length,
      off: rows.filter((r) => !r.enabled).length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === 'all' || (filter === 'on' ? r.enabled : !r.enabled)) &&
        (typeFilters.length === 0 ||
          typeFilters.some((type) => (r.modalities?.length ? r.modalities : [r.modelType]).includes(type))) &&
        (vendorFilter === 'all' || r.vendor === vendorFilter) &&
        (!kw ||
          r.modelCode.toLowerCase().includes(kw) ||
          r.modelName.toLowerCase().includes(kw) ||
          r.vendorName.toLowerCase().includes(kw))
    );
  }, [rows, filter, typeFilters, vendorFilter, keyword]);

  // 表体高度跟随容器：窗口缩放 / 数据量变化后重新测量
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const header = el.querySelector('.ant-table-thead') as HTMLElement | null;
      const headerHeight = header?.offsetHeight ?? 48;
      setBodyHeight(Math.max(160, Math.floor(el.clientHeight - headerHeight - 1)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const timer = window.setTimeout(measure, 120);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [loading, filtered.length]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      vendor: vendors[0]?.vendor ?? 'dashscope',
      modelType: 'text',
      modalities: ['text'],
      maxContextTokens: 32768,
      temperature: 0.7,
      enabled: true,
    });
    setFormOpen(true);
  };

  const openEdit = (row: AdminLlmModel) => {
    setEditing(row);
    form.setFieldsValue({
      vendor: row.vendor,
      modelCode: row.modelCode,
      modelName: row.modelName,
      modelType: row.modelType,
      modalities: row.modalities?.length ? row.modalities : [row.modelType],
      maxContextTokens: row.maxContextTokens,
      temperature: Number(row.temperature),
      enabled: row.enabled,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const payload = {
        vendor: String(values.vendor),
        modelCode: String(values.modelCode ?? '').trim(),
        modelName: values.modelName ? String(values.modelName).trim() : undefined,
        modelType: String(values.modelType ?? 'text'),
        modalities: Array.isArray(values.modalities) && values.modalities.length > 0
          ? (values.modalities as string[])
          : [String(values.modelType ?? 'text')],
        maxContextTokens: Number(values.maxContextTokens) || 32768,
        temperature: values.temperature === undefined ? 0.7 : Number(values.temperature),
        enabled: Boolean(values.enabled),
      };
      if (editing) {
        await updateAdminModel(editing.id, payload);
        message.success(`已更新模型 ${payload.modelCode}`);
      } else {
        await createAdminModel(payload);
        message.success(`已新增模型 ${payload.modelCode}`);
      }
      setFormOpen(false);
      void load(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (row: AdminLlmModel, enabled: boolean) => {
    try {
      const updated = await setAdminModelEnabled(row.id, enabled);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      message.success(`${row.modelName} ${enabled ? '已上架' : '已下架'}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const onDelete = async (row: AdminLlmModel) => {
    try {
      await deleteAdminModel(row.id);
      message.success(`已删除模型 ${row.modelCode}`);
      void load(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      const result = await syncVendorModels(syncVendor, syncEnableNew);
      setSyncOpen(false);
      void load(true);
      Modal.info({
        title: `${result.vendorName} 同步完成`,
        width: 560,
        okText: '知道了',
        content: (
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>{result.message}</div>
            {result.addedCodes.length > 0 && (
              <div
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontSize: 12,
                  color: colors.textSecondary,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  marginBottom: 8,
                }}
              >
                {result.addedCodes.slice(0, 40).join('、')}
                {result.addedCodes.length > 40 ? ` 等 ${result.addedCodes.length} 个` : ''}
              </div>
            )}
            {result.updatedCodes.length > 0 && (
              <div
                style={{
                  maxHeight: 160,
                  overflowY: 'auto',
                  fontSize: 12,
                  color: colors.textSecondary,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  marginBottom: 8,
                }}
              >
                <div style={{ marginBottom: 4, color: colors.text }}>已修正类型 / 模态：</div>
                {result.updatedCodes.slice(0, 40).join('、')}
                {result.updatedCodes.length > 40 ? ` 等 ${result.updatedCodes.length} 个` : ''}
              </div>
            )}
            <div style={{ color: colors.textTertiary }}>
              同步会补齐缺失模型，并刷新已有模型的主类型与全部模态；不会删除模型，也不会覆盖上下架、温度和上下文设置。
            </div>
          </div>
        ),
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const columns: ColumnsType<AdminLlmModel> = [
    {
      title: '供应商',
      dataIndex: 'vendorName',
      width: 110,
      render: (_: unknown, row) => (
        <Tag
          style={{
            marginInlineEnd: 0,
            border: 'none',
            background: colors.primary10,
            color: colors.text,
            fontSize: 12,
          }}
        >
          {row.vendorName}
        </Tag>
      ),
    },
    {
      title: '模型',
      dataIndex: 'modelName',
      render: (_: unknown, row) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{row.modelName}</div>
          <div style={{ fontSize: 12, color: colors.textTertiary }}>{row.modelCode}</div>
        </div>
      ),
    },
    {
      title: '类型 / 模态',
      dataIndex: 'modalities',
      key: 'modalities',
      width: 300,
      filters: MODEL_TYPE_OPTIONS.map((option) => ({
        text: option.label,
        value: option.value,
      })),
      filteredValue: typeFilters.length > 0 ? typeFilters : null,
      onFilter: (value, record) => {
        const list = record.modalities?.length ? record.modalities : [record.modelType];
        return list.includes(String(value));
      },
      render: (_: unknown, row) => (
        <ModelModalityTags types={row.modalities} fallback={row.modelType} compact />
      ),
    },
    {
      title: '上下文',
      dataIndex: 'maxContextTokens',
      width: 100,
      render: (value: number) => `${Math.round(value / 1024)}K`,
    },
    {
      title: '温度',
      dataIndex: 'temperature',
      width: 80,
      render: (value: number) => Number(value).toFixed(2),
    },
    {
      title: '绑定',
      dataIndex: 'bindingCount',
      width: 80,
      render: (value: number) =>
        value > 0 ? <Tag color="geekblue">{value}</Tag> : <span style={{ color: colors.textTertiary }}>—</span>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      filters: [
        { text: '已上架', value: 'on' },
        { text: '未上架', value: 'off' },
      ],
      filterMultiple: false,
      filteredValue: filter === 'all' ? null : [filter],
      onFilter: (value, record) => record.enabled === (String(value) === 'on'),
      render: (_: unknown, row) => (
        <Space size={8}>
          <Switch size="small" checked={row.enabled} onChange={(value) => void onToggle(row, value)} />
          <span style={{ fontSize: 12, color: colors.textSecondary }}>{row.enabled ? '已上架' : '未上架'}</span>
        </Space>
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, row) => (
        <Space size={10}>
          <a onClick={() => openEdit(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon icon={editIcon} width={13} />
            编辑
          </a>
          {row.bindingCount > 0 ? (
            <span style={{ color: colors.textTertiary, cursor: 'not-allowed' }} title="仍有用户绑定，请先下架并让用户解绑">
              <Icon icon={trashIcon} width={13} /> 删除
            </span>
          ) : (
            <Popconfirm
              title={`删除模型 ${row.modelCode}？`}
              description="删除后不可恢复；用户将无法再绑定该模型。"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => void onDelete(row)}
            >
              <a style={{ color: '#ff4d4f', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon icon={trashIcon} width={13} />
                删除
              </a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 420,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {(busy || syncing) && <SlimProgress />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon icon={databaseIcon} width={18} />
            模型目录
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
            目录是唯一真源：用户看到的、能绑定的模型都来自这里。可手工增删改查，也可从供应商拉取模型（含类型）。
          </p>
        </div>
        <Space>
          <Button icon={<Icon icon={refreshIcon} width={15} />} onClick={() => setSyncOpen(true)}>
            从供应商同步
          </Button>
          <Button type="primary" icon={<Icon icon={plusIcon} width={15} />} onClick={openCreate}>
            新增模型
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 14, flexShrink: 0, width: '100%' }} wrap>
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as 'all' | 'on' | 'off')}
          options={[
            { label: `全部 ${counts.all}`, value: 'all' },
            { label: `已上架 ${counts.on}`, value: 'on' },
            { label: `未上架 ${counts.off}`, value: 'off' },
          ]}
        />
        <Select
          value={vendorFilter}
          onChange={setVendorFilter}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: '全部供应商' },
            ...vendors.map((v) => ({ value: v.vendor, label: v.vendorName })),
          ]}
        />
        <Input
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          prefix={<Icon icon={searchIcon} width={14} />}
          placeholder="搜索模型名称 / 编码 / 供应商"
          style={{ width: 260 }}
        />
        {keyword.trim() && (
          <span style={{ fontSize: 12, color: colors.textTertiary }}>命中 {filtered.length} / {rows.length}</span>
        )}
      </Space>

      <div
        ref={tableWrapRef}
        className="admin-panel"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : (
          <Table<AdminLlmModel>
            className="admin-table"
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={filtered}
            pagination={false}
            scroll={{ y: bodyHeight }}
            onChange={(_, filters) => {
              const nextTypeFilters = Array.isArray(filters.modalities)
                ? filters.modalities.map(String)
                : [];
              setTypeFilters(nextTypeFilters);

              const nextStatus = Array.isArray(filters.enabled) && filters.enabled.length > 0
                ? String(filters.enabled[0])
                : 'all';
              setFilter(nextStatus === 'on' || nextStatus === 'off' ? nextStatus : 'all');
            }}
            locale={{ emptyText: '暂无模型，点击「新增模型」或「从供应商同步」补齐' }}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        title={editing ? '编辑模型' : '新增模型'}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onCancel={() => setFormOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item name="vendor" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select
              disabled={Boolean(editing && editing.bindingCount > 0)}
              options={vendors.map((v) => ({ value: v.vendor, label: v.vendorName }))}
            />
          </Form.Item>
          <Form.Item
            name="modelCode"
            label="模型编码"
            tooltip="调用供应商时使用的 model 名称，例如 qwen-plus / deepseek-chat"
            rules={[{ required: true, message: '请输入模型编码' }]}
          >
            <Input
              placeholder="qwen-plus"
              disabled={Boolean(editing && editing.bindingCount > 0)}
              maxLength={64}
            />
          </Form.Item>
          <Form.Item name="modelName" label="展示名称" tooltip="留空则使用模型编码">
            <Input placeholder="通义千问 Plus" maxLength={64} />
          </Form.Item>
          <Form.Item
            name="modelType"
            label="主类型"
            tooltip="主类型决定对话门控和连通校验方式；完整模态在下一项配置"
            rules={[{ required: true, message: '请选择主类型' }]}
          >
            <Select options={MODEL_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="modalities"
            label="支持的全部模态"
            tooltip="可多选，例如推理模型同时支持文本与图片：text + reasoning + vision。留空则只保存主类型。"
          >
            <Select mode="multiple" allowClear options={MODEL_TYPE_OPTIONS} placeholder="选择该模型支持的全部模态" />
          </Form.Item>
          <Space size={16} style={{ display: 'flex' }}>
            <Form.Item name="maxContextTokens" label="上下文窗口（tokens）" style={{ flex: 1 }} rules={[{ required: true }]}>
              <InputNumber min={1024} max={2000000} step={1024} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="temperature" label="默认温度" style={{ flex: 1 }} rules={[{ required: true }]}>
              <InputNumber min={0} max={2} step={0.1} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="enabled" label="是否上架" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
          {editing && editing.bindingCount > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: colors.textTertiary }}>
              该模型已有 {editing.bindingCount} 条用户绑定，供应商与编码不可修改。
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        open={syncOpen}
        title="从供应商同步模型"
        okText="开始同步"
        cancelText="取消"
        confirmLoading={syncing}
        onCancel={() => setSyncOpen(false)}
        onOk={() => void onSync()}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>供应商</div>
            <Select
              value={syncVendor}
              onChange={setSyncVendor}
              style={{ width: '100%' }}
              options={vendors.map((v) => ({ value: v.vendor, label: v.vendorName }))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Switch checked={syncEnableNew} onChange={setSyncEnableNew} size="small" />
            <span style={{ fontSize: 13 }}>新增项直接上架（默认不上架，由你挑选）</span>
          </div>
          <div style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 1.7 }}>
            同步会补齐目录里缺失的模型，并刷新已有模型的主类型与全部模态；不删除模型，不覆盖上下架、温度和上下文设置。
            需要该供应商的有效 AK：优先服务端兜底配置，其次你在模型配置页保存的 AK。
            百炼同步会按 capabilities 记录全部模态（文本 / 推理 / 多模态理解 / 图像 / 视频 / 语音 / 向量等），不再只保留一个类型。
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ModelsPage;
