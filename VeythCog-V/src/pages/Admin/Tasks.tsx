import React, { useEffect, useState } from 'react';
import { Table, Switch, Button, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import playIcon from '@iconify-icons/lucide/play';
import { useTheme } from '@/contexts/ThemeContext';
import { getTasks, toggleTask, runTaskNow } from '@/api/admin';
import type { ScheduledTask } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';

const TasksPage: React.FC = () => {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getTasks();
    setTasks(data);
    setLoading(false);
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
    { title: '任务', dataIndex: 'name', render: (v: string, r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{v}</div>
        <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{r.description}</div>
      </div>
    )},
    { title: '调度 (cron)', dataIndex: 'cron', width: 130, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: '上次执行',
      dataIndex: 'lastRunAt',
      width: 140,
      render: (v?: number) => (v ? formatRelativeTime(v) : '从未'),
    },
    {
      title: '状态',
      dataIndex: 'lastStatus',
      width: 90,
      render: (v: string) => {
        if (v === 'success') return <Tag color="success">成功</Tag>;
        if (v === 'failed') return <Tag color="error">失败</Tag>;
        return <Tag>未运行</Tag>;
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 70,
      render: (v: boolean, r) => <Switch checked={v} onChange={(val) => onToggle(r, val)} />,
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button size="small" type="text" icon={<Icon icon={playIcon} width={14} />} onClick={() => onRunNow(r)}>
          立即执行
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>定时任务</h2>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
          后台自动清理和统计任务的调度状态
        </p>
      </div>
      <Table className="admin-table" rowKey="id" columns={columns} dataSource={tasks} loading={loading} pagination={false} size="middle" />
    </div>
  );
};

export default TasksPage;
