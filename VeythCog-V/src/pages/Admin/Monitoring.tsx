import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTheme } from '@/contexts/ThemeContext';
import { getCallStats, getOnlineSessions, kickSession, getErrorLogs } from '@/api/admin';
import type { CallStatDay, OnlineSession, ErrorLog } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';

const MonitoringPage: React.FC = () => {
  const { colors } = useTheme();
  const [stats, setStats] = useState<CallStatDay[]>([]);
  const [sessions, setSessions] = useState<OnlineSession[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, o, e] = await Promise.all([getCallStats(), getOnlineSessions(), getErrorLogs()]);
    setStats(s);
    setSessions(o);
    setErrors(e);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const totalCalls = stats.reduce((a, b) => a + b.calls, 0);
  const totalTokens = stats.reduce((a, b) => a + b.tokens, 0);
  const maxCalls = Math.max(...stats.map((s) => s.calls), 1);

  const kickCols: ColumnsType<OnlineSession> = [
    { title: '用户', dataIndex: 'name', render: (_, r) => `${r.name} (@${r.username})` },
    { title: 'IP', dataIndex: 'ip', width: 130 },
    { title: '登录时间', dataIndex: 'loginAt', render: (v: number) => formatRelativeTime(v) },
    { title: '最后活跃', dataIndex: 'lastActiveAt', render: (v: number) => formatRelativeTime(v) },
    {
      title: '操作',
      width: 90,
      render: (_, r) => (
        <Popconfirm title="强制下线" description={`将 ${r.name} 从该会话登出？`} onConfirm={async () => { await kickSession(r.sessionId); message.success('已强制下线'); void load(); }} okText="下线" cancelText="取消">
          <Button size="small" danger type="text">下线</Button>
        </Popconfirm>
      ),
    },
  ];

  const errCols: ColumnsType<ErrorLog> = [
    { title: '时间', dataIndex: 'time', width: 150, render: (v: number) => formatRelativeTime(v) },
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => (v === 'error' ? <Tag color="error">ERROR</Tag> : <Tag color="warning">WARN</Tag>),
    },
    { title: '来源', dataIndex: 'source', width: 130 },
    { title: '信息', dataIndex: 'message' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>系统监控</h2>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
          调用量、在线会话和最近错误
        </p>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '今日调用次数', value: stats[stats.length - 1]?.calls ?? 0, sub: `近 7 天共 ${totalCalls} 次` },
          { label: '今日 Token 消耗', value: stats[stats.length - 1]?.tokens ?? 0, sub: `近 7 天共 ${totalTokens.toLocaleString()} tokens` },
          { label: '在线会话', value: sessions.length, sub: `${errors.filter((e) => e.level === 'error').length} 条未处理错误` },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: colors.surface,
              borderRadius: 'var(--radius-lg)',
              border: `1px solid ${colors.border}`,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.primary }}>{card.value.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 调用趋势柱状图（纯 CSS） */}
      <section
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>近 7 天调用趋势</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
          {stats.map((d) => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, color: colors.textTertiary }}>{d.calls}</div>
              <div
                style={{
                  width: '100%',
                  maxWidth: 40,
                  height: `${(d.calls / maxCalls) * 110}px`,
                  background: colors.primary,
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.85,
                }}
              />
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{d.date}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 在线会话 */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>在线会话（{sessions.length}）</div>
        <Table rowKey="sessionId" columns={kickCols} dataSource={sessions} pagination={false} size="small" loading={loading} />
      </section>

      {/* 错误日志 */}
      <section>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>最近错误</div>
        <Table rowKey="id" columns={errCols} dataSource={errors} pagination={false} size="small" loading={loading} />
      </section>
    </div>
  );
};

export default MonitoringPage;
