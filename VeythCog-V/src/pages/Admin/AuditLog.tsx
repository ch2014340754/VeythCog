import React, { useEffect, useMemo, useState } from 'react';
import { Table, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '@/components/PageHeader';
import ListSentinel from '@/components/ListSentinel';
import useInfiniteRows from '@/hooks/useInfiniteRows';
import { getAuditLogs } from '@/api/admin';
import type { AuditLogEntry } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          !filter ||
          l.username.includes(filter) ||
          l.action.includes(filter) ||
          l.detail.includes(filter),
      ),
    [logs, filter],
  );

  const columns: ColumnsType<AuditLogEntry> = [
    { title: '时间', dataIndex: 'time', width: 160, render: (v: number) => formatRelativeTime(v) },
    { title: '用户', dataIndex: 'username', width: 110, render: (v: string) => <strong>@{v}</strong> },
    { title: '操作', dataIndex: 'action', width: 120 },
    { title: '详情', dataIndex: 'detail' },
    { title: 'IP', dataIndex: 'ip', width: 140 },
  ];

  const { visible, hasMore, total, sentinelRef } = useInfiniteRows(filtered, { pageSize: 20 });

  return (
    <div className="vc-page vc-page--list">
      <div className="vc-page__body">
        <PageHeader
          eyebrow="Admin / Audit"
          title="审计日志"
          description="记录登录、配置变更和重要业务操作，按用户、操作或详情检索。"
          extra={
            <Input.Search
              placeholder="搜索用户 / 操作 / 详情…"
              allowClear
              style={{ width: 280 }}
              onChange={(e) => setFilter(e.target.value)}
            />
          }
        />

        <section className="vc-panel vc-panel--flush vc-table-card vc-table-card--fill">
          <div className="vc-table-card__bar">
            <span className="vc-table-card__title">操作记录</span>
            <span className="vc-table-card__side vc-meta">
              共 <span className="vc-num">{total}</span> 条
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
      </div>
    </div>
  );
};

export default AuditLogPage;
