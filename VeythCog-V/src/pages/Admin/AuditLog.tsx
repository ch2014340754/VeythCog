import React, { useEffect, useState } from 'react';
import { Table, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTheme } from '@/contexts/ThemeContext';
import { getAuditLogs } from '@/api/admin';
import type { AuditLogEntry } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';

const AuditLogPage: React.FC = () => {
  const { colors } = useTheme();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await getAuditLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = logs.filter(
    (l) =>
      !filter ||
      l.username.includes(filter) ||
      l.action.includes(filter) ||
      l.detail.includes(filter),
  );

  const columns: ColumnsType<AuditLogEntry> = [
    { title: '时间', dataIndex: 'time', width: 160, render: (v: number) => formatRelativeTime(v) },
    { title: '用户', dataIndex: 'username', width: 100, render: (v: string) => <strong>@{v}</strong> },
    { title: '操作', dataIndex: 'action', width: 110 },
    { title: '详情', dataIndex: 'detail' },
    { title: 'IP', dataIndex: 'ip', width: 130 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>审计日志</h2>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
            记录登录、配置变更和重要业务操作
          </p>
        </div>
        <Input.Search
          placeholder="搜索用户 / 操作 / 详情…"
          allowClear
          style={{ width: 280 }}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <Table className="admin-table" rowKey="id" columns={columns} dataSource={filtered} loading={loading} pagination={{ pageSize: 20 }} size="middle" />
    </div>
  );
};

export default AuditLogPage;
