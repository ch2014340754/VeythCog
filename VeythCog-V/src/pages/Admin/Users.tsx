import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import plusIcon from '@iconify-icons/lucide/user-plus';
import editIcon from '@iconify-icons/lucide/pencil';
import trashIcon from '@iconify-icons/lucide/trash-2';
import keyIcon from '@iconify-icons/lucide/key-round';
import { useTheme } from '@/contexts/ThemeContext';
import PageHeader from '@/components/PageHeader';
import ListSentinel from '@/components/ListSentinel';
import useInfiniteRows from '@/hooks/useInfiniteRows';
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword } from '@/api/admin';
import type { AdminUser } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';

const UsersPage: React.FC = () => {
  const { colors } = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建用户
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  // 编辑用户
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);

  // 重置密码
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [resetForm] = Form.useForm();
  const [resettingPwd, setResettingPwd] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    const vals = await createForm.validateFields();
    setCreating(true);
    await createUser(vals);
    setCreating(false);
    setCreateOpen(false);
    createForm.resetFields();
    message.success('用户已创建');
    void load();
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    const vals = await editForm.validateFields();
    setSavingEdit(true);
    await updateUser(editing.id, vals);
    setSavingEdit(false);
    setEditing(null);
    message.success('用户已更新');
    void load();
  };

  const onResetPwd = async () => {
    if (!resetting) return;
    const vals = await resetForm.validateFields();
    setResettingPwd(true);
    await resetUserPassword(resetting.id, vals.password);
    setResettingPwd(false);
    setResetting(null);
    resetForm.resetFields();
    message.success(`已重置 ${resetting.name} 的密码`);
  };

  const onToggleStatus = async (u: AdminUser) => {
    const next = u.status === 'active' ? 'disabled' : 'active';
    await updateUser(u.id, { status: next });
    message.success(next === 'active' ? `已启用 ${u.name}` : `已禁用 ${u.name}`);
    void load();
  };

  const onDelete = async (id: string) => {
    await deleteUser(id);
    message.success('用户已删除');
    void load();
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: '用户',
      dataIndex: 'name',
      render: (_, r) => (
        <div className="vc-user-cell">
          <span
            className="vc-user-cell__avatar"
            style={{ background: colors.primary, color: colors.textInverse }}
          >
            {r.name.charAt(0).toUpperCase()}
          </span>
          <span className="vc-user-cell__meta">
            <span className="vc-user-cell__name">{r.name}</span>
            <span className="vc-user-cell__sub">@{r.username}</span>
          </span>
        </div>
      ),
    },
    { title: '邮箱', dataIndex: 'email', render: (v?: string) => v || <span className="vc-meta">—</span> },
    {
      title: '角色',
      dataIndex: 'role',
      width: 96,
      render: (v: string) =>
        v === 'admin' ? <Tag color="purple">管理员</Tag> : <Tag>用户</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (v: string) =>
        v === 'active' ? <Tag color="success">正常</Tag> : <Tag color="error">已禁用</Tag>,
    },
    {
      title: '对话数',
      dataIndex: 'conversationCount',
      width: 80,
      align: 'center',
      render: (v: number) => <span className="vc-num">{v}</span>,
    },
    {
      title: '文档数',
      dataIndex: 'kbDocumentCount',
      width: 80,
      align: 'center',
      render: (v: number) => <span className="vc-num">{v}</span>,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 130,
      render: (v?: number) => (v ? formatRelativeTime(v) : <span className="vc-meta">从未</span>),
    },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space size={2}>
          <Button
            type="text"
            size="small"
            title="编辑"
            icon={<Icon icon={editIcon} width={14} />}
            onClick={() => {
              setEditing(r);
              editForm.setFieldsValue({ name: r.name, email: r.email, role: r.role });
            }}
          />
          <Button
            type="text"
            size="small"
            title="重置密码"
            icon={<Icon icon={keyIcon} width={14} />}
            onClick={() => {
              setResetting(r);
              resetForm.resetFields();
            }}
          />
          <Button
            type="text"
            size="small"
            onClick={() => onToggleStatus(r)}
            danger={r.status === 'active'}
          >
            {r.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="删除用户"
            description={`删除后不可恢复，确认删除 ${r.name}？`}
            onConfirm={() => onDelete(r.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="text" size="small" danger title="删除" icon={<Icon icon={trashIcon} width={14} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const { visible, hasMore, total, sentinelRef } = useInfiniteRows(users, { pageSize: 20 });

  return (
    <div className="vc-page vc-page--list">
      <div className="vc-page__body">
        <PageHeader
          eyebrow="Admin / Users"
          title="用户管理"
          description="管理平台注册用户，禁用后该用户无法登录。"
          extra={
            <Button type="primary" icon={<Icon icon={plusIcon} width={16} />} onClick={() => setCreateOpen(true)}>
              新增用户
            </Button>
          }
        />

        <section className="vc-panel vc-panel--flush vc-table-card vc-table-card--fill">
          <div className="vc-table-card__bar">
            <span className="vc-table-card__title">用户列表</span>
            <span className="vc-table-card__side vc-meta">
              共 <span className="vc-num">{total}</span> 位用户
            </span>
          </div>
          <div className="vc-table-fill">
            <Table
              className="admin-table"
              rowKey="id"
              columns={columns}
              dataSource={visible}
              loading={loading}
              pagination={false}
              size="middle"
            />
            <ListSentinel total={total} shown={visible.length} hasMore={hasMore} sentinelRef={sentinelRef} />
          </div>
        </section>

        {/* 新建用户 */}
        <Modal
          title="新增用户"
          open={createOpen}
          onOk={onCreate}
          confirmLoading={creating}
          onCancel={() => setCreateOpen(false)}
          okText="创建"
          cancelText="取消"
        >
          <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="登录账号" />
            </Form.Item>
            <Form.Item label="昵称" name="name" rules={[{ required: true, message: '请输入昵称' }]}>
              <Input placeholder="显示名" />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <Input placeholder="可选" />
            </Form.Item>
            <Form.Item label="角色" name="role" initialValue="user" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'user', label: '普通用户' },
                  { value: 'admin', label: '管理员' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="初始密码"
              name="password"
              rules={[{ required: true, min: 6, message: '至少 6 位' }]}
            >
              <Input.Password placeholder="至少 6 位" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑用户 */}
        <Modal
          title={`编辑用户：${editing?.name ?? ''}`}
          open={!!editing}
          onOk={onSaveEdit}
          confirmLoading={savingEdit}
          onCancel={() => setEditing(null)}
          okText="保存"
          cancelText="取消"
        >
          <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item label="昵称" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <Input />
            </Form.Item>
            <Form.Item label="角色" name="role" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'user', label: '普通用户' },
                  { value: 'admin', label: '管理员' },
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>

        {/* 重置密码 */}
        <Modal
          title={`重置密码：${resetting?.name ?? ''}`}
          open={!!resetting}
          onOk={onResetPwd}
          confirmLoading={resettingPwd}
          onCancel={() => setResetting(null)}
          okText="确认重置"
          cancelText="取消"
        >
          <Form form={resetForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item
              label="新密码"
              name="password"
              rules={[{ required: true, min: 6, message: '至少 6 位' }]}
            >
              <Input.Password placeholder="至少 6 位" />
            </Form.Item>
            <Form.Item
              label="确认新密码"
              name="confirm"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('两次输入不一致'));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default UsersPage;
