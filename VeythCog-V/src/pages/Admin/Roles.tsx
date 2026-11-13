import React, { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { getRoles, type RoleItem } from '@/api/admin';

const RolesPage: React.FC = () => {
  const { colors } = useTheme();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getRoles();
      setRoles(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const columns = [
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
      render: (v: string) => <Tag color={v === 'admin' ? 'red' : 'blue'}>{v}</Tag>,
    },
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
  ];

  return (
    <div>
      <h2 style={{ color: colors.text, marginBottom: 20 }}>角色管理</h2>
      <Table
        className="admin-table"
        rowKey="id"
        columns={columns}
        dataSource={roles}
        loading={loading}
        pagination={false}
      />
    </div>
  );
};

export default RolesPage;
