import React, { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '@/components/PageHeader';
import ListSentinel from '@/components/ListSentinel';
import useInfiniteRows from '@/hooks/useInfiniteRows';
import { getRoles, type RoleItem } from '@/api/admin';

const RolesPage: React.FC = () => {
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

  const columns: ColumnsType<RoleItem> = [
    {
      title: '角色编码',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => <Tag color={v === 'admin' ? 'red' : 'blue'}>{v}</Tag>,
    },
    { title: '角色名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', key: 'description' },
  ];

  const { visible, hasMore, total, sentinelRef } = useInfiniteRows(roles, { pageSize: 20 });

  return (
    <div className="vc-page vc-page--list">
      <div className="vc-page__body">
        <PageHeader
          eyebrow="Admin / Roles"
          title="角色管理"
          description="系统中可分配的角色以及各自的能力范围。"
        />

        <section className="vc-panel vc-panel--flush vc-table-card vc-table-card--fill">
          <div className="vc-table-card__bar">
            <span className="vc-table-card__title">角色列表</span>
            <span className="vc-table-card__side vc-meta">
              共 <span className="vc-num">{total}</span> 个角色
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
            />
            <ListSentinel total={total} shown={visible.length} hasMore={hasMore} sentinelRef={sentinelRef} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default RolesPage;
