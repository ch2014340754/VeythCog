import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import plusIcon from '@iconify-icons/lucide/user-plus';
import editIcon from '@iconify-icons/lucide/pencil';
import trashIcon from '@iconify-icons/lucide/trash-2';
import keyIcon from '@iconify-icons/lucide/key-round';
import { useTheme } from '@/contexts/ThemeContext';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: colors.primary,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {r.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: colors.textTertiary }}>@{r.username}</div>
          </div>
        </div>
      ),
    },
    { title: '邮箱', dataIndex: 'email', render: (v?: string) => v || '—' },
    {
      title: '角色',
      dataIndex: 'role',
      width: 90,
      render: (v: string) =>
        v === 'admin' ? <Tag color="purple">管理员</Tag> : <Tag>用户</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) =>
        v === 'active' ? <Tag color="success">正常</Tag> : <Tag color="error">已禁用</Tag>,
    },
    {
      title: '对话数',
      dataIndex: 'conversationCount',
      width: 80,
      align: 'center',
    },
    {
      title: '文档数',
      dataIndex: 'kbDocumentCount',
      width: 80,
      align: 'center',
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 120,
      render: (v?: number) => (v ? formatRelativeTime(v) : '从未'),
    },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<Icon icon={editIcon} width={14} />}
            onClick={() => {
              setEditing(r);
              editForm.setFieldsValue({ name: r.name, email: r.email, role: r.role });
            }}
          />
          <Button
            type="text"
            size="small"
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
            <Button type="text" size="small" danger icon={<Icon icon={trashIcon} width={14} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>用户管理</h2>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
            管理平台注册用户，禁用后该用户无法登录
          </p>
        </div>
        <Button type="primary" icon={<Icon icon={plusIcon} width={16} />} onClick={() => setCreateOpen(true)}>
          新增用户
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={false}
        size="middle"
      />

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
  );
};

export default UsersPage;
