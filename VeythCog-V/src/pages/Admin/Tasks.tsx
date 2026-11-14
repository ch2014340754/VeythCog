import React, { useEffect, useState } from 'react';
import { Table, Switch, Button, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import playIcon from '@iconify-icons/lucide/play';
import PageHeader from '@/components/PageHeader';
import ListSentinel from '@/components/ListSentinel';
import useInfiniteRows from '@/hooks/useInfiniteRows';
import { getTasks, toggleTask, runTaskNow } from '@/api/admin';
import type { ScheduledTask } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onToggle = async (t: ScheduledTask, enabled: boolean) => {
    await toggleTask(t.id, enabled);
    message.success(`${t.name} 已${enabled ? '启用' : '停用'}`);
    void load();
  };

  const onRunNow = async (t: ScheduledTask) => {
    message.loading({ content: `正在执行 ${t.name}…`, key: t.id });
    await runTaskNow(t.id);
    message.success({ content: `${t.name} 执行完成`, key: t.id });
    void load();
  };

  const columns: ColumnsType<ScheduledTask> = [
    {
      title: '任务',
      dataIndex: 'name',
      render: (v: string, r) => (
        <div className="vc-task-cell">
          <div className="vc-task-cell__name">{v}</div>
          <div className="vc-task-cell__desc">{r.description}</div>
        </div>
      ),
    },
    {
      title: '调度 (cron)',
      dataIndex: 'cron',
      width: 140,
      render: (v: string) => <code className="vc-mono">{v}</code>,
    },
    {
      title: '上次执行',
      dataIndex: 'lastRunAt',
      width: 140,
      render: (v?: number) => (v ? formatRelativeTime(v) : <span className="vc-meta">从未</span>),
    },
    {
      title: '状态',
      dataIndex: 'lastStatus',
      width: 110,
      render: (v: string) => {
        if (v === 'success') return <Tag color="success">成功</Tag>;
        if (v === 'failed') return <Tag color="error">失败</Tag>;
        return <Tag>未运行</Tag>;
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean, r) => <Switch checked={v} onChange={(val) => onToggle(r, val)} />,
    },
    {
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Button size="small" type="text" icon={<Icon icon={playIcon} width={14} />} onClick={() => onRunNow(r)}>
          立即执行
        </Button>
      ),
    },
  ];

  const { visible, hasMore, total, sentinelRef } = useInfiniteRows(tasks, { pageSize: 20 });

  return (
    <div className="vc-page vc-page--list">
      <div className="vc-page__body">
        <PageHeader
          eyebrow="Admin / Tasks"
          title="定时任务"
          description="后台自动清理和统计任务的调度状态，可手动触发一次执行。"
        />

        <section className="vc-panel vc-panel--flush vc-table-card vc-table-card--fill">
          <div className="vc-table-card__bar">
            <span className="vc-table-card__title">调度列表</span>
            <span className="vc-table-card__side vc-meta">
              共 <span className="vc-num">{total}</span> 个任务
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

export default TasksPage;
