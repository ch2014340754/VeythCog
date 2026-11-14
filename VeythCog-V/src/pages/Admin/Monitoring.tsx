import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Popconfirm, Segmented, Space, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import activityIcon from '@iconify-icons/lucide/activity';
import cpuIcon from '@iconify-icons/lucide/cpu';
import barChartIcon from '@iconify-icons/lucide/bar-chart-3';
import PageHeader from '@/components/PageHeader';
import ListSentinel from '@/components/ListSentinel';
import useInfiniteRows from '@/hooks/useInfiniteRows';
import EmptyState from '@/components/states/EmptyState';
import LoadingState from '@/components/states/LoadingState';
import {
  getMonitorEndpoints,
  getMonitorErrors,
  getMonitorLlm,
  getMonitorOverview,
  getMonitorResources,
  getMonitorSessions,
  getMonitorTimeseries,
  kickSession,
} from '@/api/admin';
import type {
  MonitorEndpoint,
  MonitorError,
  MonitorLlmSummary,
  MonitorOverview,
  MonitorPoint,
  MonitorResource,
  MonitorSession,
} from '@/types';

const REFRESH_MS = 60_000;
/** 接口排行、在线会话、最近错误初始展示 7 行，下滑自动追加 */
const PREVIEW_ROWS = 7;

function fmtBytes(value: number): string {
  if (value < 0) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtPercent(value: number, digits = 1): string {
  if (value < 0) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtUptime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes % 60} 分`;
  return `${minutes} 分钟`;
}

/** 趋势轴标签：小时桶取 HH:00，天桶取 MM-DD */
function axisLabel(time: string): string {
  if (time.includes(' ')) return time.slice(11, 16);
  return time.length >= 10 ? time.slice(5) : time;
}

/** 监控页各分区共用的容器：标题 + 说明 + 右侧元信息 */
const SectionHead: React.FC<{
  title: React.ReactNode;
  desc?: React.ReactNode;
  side?: React.ReactNode;
}> = ({ title, desc, side }) => (
  <div className="vc-table-card__bar">
    <div>
      <div className="vc-table-card__title">{title}</div>
      {desc && <div className="vc-meta">{desc}</div>}
    </div>
    {side && <div className="vc-table-card__side">{side}</div>}
  </div>
);

const MonitoringPage: React.FC = () => {
  const [hours, setHours] = useState(24);
  const [overview, setOverview] = useState<MonitorOverview | null>(null);
  const [points, setPoints] = useState<MonitorPoint[]>([]);
  const [endpoints, setEndpoints] = useState<MonitorEndpoint[]>([]);
  const [endpointSort, setEndpointSort] = useState<'calls' | 'errors' | 'p95'>('calls');
  const [errors, setErrors] = useState<MonitorError[]>([]);
  const [llm, setLlm] = useState<MonitorLlmSummary | null>(null);
  const [sessions, setSessions] = useState<MonitorSession[]>([]);
  const [resource, setResource] = useState<MonitorResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ov, pts, eps, errs, llmData, sess, res] = await Promise.all([
        getMonitorOverview(hours),
        getMonitorTimeseries(hours),
        getMonitorEndpoints(hours, endpointSort, 20),
        getMonitorErrors(hours, 40),
        getMonitorLlm(hours),
        getMonitorSessions(),
        getMonitorResources(),
      ]);
      if (!mounted.current) return;
      setOverview(ov);
      setPoints(pts);
      setEndpoints(eps);
      setErrors(errs);
      setLlm(llmData);
      setSessions(sess);
      setResource(res);
      setUpdatedAt(new Date());
    } catch (e) {
      if (mounted.current && !silent) {
        message.error((e as Error).message || '监控数据加载失败');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [hours, endpointSort]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [load]);

  const stats = useMemo(() => {
    if (!overview) return [];
    const errorPct = overview.errorRate * 100;
    return [
      { label: hours === 24 ? '近 24h 调用' : '近 7 天调用', value: overview.calls.toLocaleString(), sub: `最近 1 分钟 ${overview.callsLastMinute} 次` },
      { label: '失败率', value: `${errorPct.toFixed(errorPct < 0.1 && errorPct > 0 ? 2 : 1)}%`, sub: `${overview.errors} 次业务失败`, danger: overview.errors > 0 },
      { label: 'P95 耗时', value: `${overview.p95Ms} ms`, sub: `平均 ${overview.avgCostMs} ms` },
      { label: 'Token 消耗', value: overview.totalTokens.toLocaleString(), sub: `输出 ${overview.completionTokens.toLocaleString()} · 估算 ${overview.estimatedCalls} 次` },
      { label: '在线会话', value: overview.onlineSessions.toLocaleString(), sub: `活跃用户 ${overview.activeUsers}` },
      { label: 'LLM 调用', value: overview.llmCalls.toLocaleString(), sub: `${hours === 24 ? '近 24h' : '近 7 天'}含失败` },
    ];
  }, [overview, hours]);

  const maxCalls = Math.max(...points.map((p) => p.calls), 1);

  /** 会话列表按「在线优先」排，后端已按最后活跃倒序返回，组内顺序保持不变 */
  const orderedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.online) - Number(a.online)),
    [sessions],
  );
  const onlineSessionCount = useMemo(() => sessions.filter((s) => s.online).length, [sessions]);

  const epRows = useInfiniteRows(endpoints, { pageSize: PREVIEW_ROWS });
  const sessRows = useInfiniteRows(orderedSessions, { pageSize: PREVIEW_ROWS });
  const errRows = useInfiniteRows(errors, { pageSize: PREVIEW_ROWS });

  const endpointCols: ColumnsType<MonitorEndpoint> = [
    {
      title: '接口',
      dataIndex: 'route',
      render: (_, r) => (
        <span className="vc-route">
          <Tag className="vc-tag-soft">{r.method}</Tag>
          {r.route}
        </span>
      ),
    },
    { title: '调用', dataIndex: 'calls', width: 80, align: 'right', render: (v: number) => <span className="vc-num">{v.toLocaleString()}</span> },
    {
      title: '错误',
      dataIndex: 'errors',
      width: 110,
      align: 'right',
      render: (v: number, r) => (
        <span className="vc-num">
          {v > 0 ? <span style={{ color: 'var(--color-error)' }}>{v}</span> : <span style={{ color: 'var(--color-text-tertiary)' }}>0</span>}
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}> / {fmtPercent(r.errorRate)}</span>
        </span>
      ),
    },
    { title: '平均', dataIndex: 'avgCostMs', width: 90, align: 'right', render: (v: number) => <span className="vc-num">{v} ms</span> },
    {
      title: 'P95',
      dataIndex: 'p95Ms',
      width: 90,
      align: 'right',
      render: (v: number) => <strong className="vc-num">{v} ms</strong>,
    },
    { title: '最大', dataIndex: 'maxCostMs', width: 90, align: 'right', render: (v: number) => <span className="vc-num">{v} ms</span> },
  ];

  const errorCols: ColumnsType<MonitorError> = [
    { title: '时间', dataIndex: 'time', width: 160 },
    {
      title: '接口',
      dataIndex: 'route',
      width: 220,
      render: (_, r) => (
        <span className="vc-route">
          <Tag className="vc-tag-soft">{r.method}</Tag>
          {r.route}
        </span>
      ),
    },
    {
      title: '业务码',
      dataIndex: 'bizCode',
      width: 100,
      render: (v: number, r) => (
        <Tooltip title={`HTTP ${r.status}`}>
          <Tag color={v === 0 ? 'default' : 'error'}>{v === 0 ? `HTTP ${r.status}` : v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '信息',
      dataIndex: 'message',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v} placement="topLeft">
          <span style={{ fontSize: 12 }}>{v || '—'}</span>
        </Tooltip>
      ),
    },
    {
      title: 'rid',
      dataIndex: 'rid',
      width: 100,
      render: (v: string) => <span className="vc-mono" style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{v}</span>,
    },
  ];

  const llmCols: ColumnsType<MonitorLlmSummary['rows'][number]> = [
    {
      title: '模型',
      dataIndex: 'modelCode',
      render: (_, r) => (
        <span className="vc-route">
          <Tag className="vc-tag-soft">{r.vendor}</Tag>
          {r.modelCode}
        </span>
      ),
    },
    { title: '调用', dataIndex: 'calls', width: 80, align: 'right', render: (v: number) => <span className="vc-num">{v.toLocaleString()}</span> },
    {
      title: '失败',
      dataIndex: 'errors',
      width: 80,
      align: 'right',
      render: (v: number) => (v > 0 ? <span className="vc-num" style={{ color: 'var(--color-error)' }}>{v}</span> : <span className="vc-num">0</span>),
    },
    {
      title: 'Token（输入 / 输出）',
      dataIndex: 'totalTokens',
      width: 210,
      align: 'right',
      render: (_, r) => (
        <Tooltip title={`输入 ${r.promptTokens.toLocaleString()} · 输出 ${r.completionTokens.toLocaleString()}`}>
          <span className="vc-num">{r.totalTokens.toLocaleString()}</span>
        </Tooltip>
      ),
    },
    { title: '平均延迟', dataIndex: 'avgLatencyMs', width: 100, align: 'right', render: (v: number) => <span className="vc-num">{v} ms</span> },
    { title: '最大延迟', dataIndex: 'maxLatencyMs', width: 100, align: 'right', render: (v: number) => <span className="vc-num">{v} ms</span> },
  ];

  const sessionCols: ColumnsType<MonitorSession> = [
    {
      title: '用户',
      dataIndex: 'username',
      render: (_, r) => (
        <span>
          {r.nickname || r.username}
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}> @{r.username}</span>
        </span>
      ),
    },
    { title: 'IP', dataIndex: 'ip', width: 130 },
    {
      title: '客户端',
      dataIndex: 'userAgent',
      width: 200,
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{v || '—'}</span>
        </Tooltip>
      ),
    },
    { title: '登录时间', dataIndex: 'loginAt', width: 160 },
    { title: '最后活跃', dataIndex: 'lastActiveAt', width: 160 },
    {
      title: '状态',
      dataIndex: 'online',
      width: 90,
      render: (v: boolean) => (v ? <Tag color="success">在线</Tag> : <Tag>闲置</Tag>),
    },
    {
      title: '操作',
      width: 80,
      render: (_, r) => (
        <Popconfirm
          title="强制下线"
          description={`让 ${r.nickname || r.username} 的这个会话立即失效？`}
          okText="下线"
          cancelText="取消"
          onConfirm={async () => {
            try {
              await kickSession(r.sid);
              message.success('已强制下线');
              void load(true);
            } catch (e) {
              message.error((e as Error).message || '操作失败');
            }
          }}
        >
          <Button size="small" type="text" danger>
            下线
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const head = (
    <PageHeader
      eyebrow="Admin / Monitor"
      title="系统监控"
      description={
        <>
          调用量、失败率、耗时、Token、会话与服务资源，全部来自真实采集。
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            {' · '}
            {updatedAt ? `更新于 ${updatedAt.toLocaleTimeString('zh-CN')}` : '加载中'}
          </span>
        </>
      }
      extra={
        <Space>
          <Segmented
            className="vc-segmented"
            value={hours}
            onChange={(v) => setHours(v as number)}
            options={[
              { label: '近 24 小时', value: 24 },
              { label: '近 7 天', value: 168 },
            ]}
          />
          <Button icon={<Icon icon={refreshIcon} width={16} />} onClick={() => void load(true)}>
            刷新
          </Button>
        </Space>
      }
    />
  );

  if (loading && !overview) {
    return (
      <div className="vc-page">
        <div className="vc-page__body vc-page__body--wide">
          {head}
          <LoadingState tip="正在拉取监控数据…" />
        </div>
      </div>
    );
  }

  return (
    <div className="vc-page">
      <div className="vc-page__body vc-page__body--wide">
        {head}

        {/* 概览卡片 */}
        <div className="vc-grid vc-grid--stats" style={{ marginBottom: 'var(--space-xl)' }}>
          {stats.map((card) => (
            <div key={card.label} className="vc-panel vc-stat">
              <div className="vc-stat__label">{card.label}</div>
              <div className={`vc-stat__value${card.danger ? ' vc-stat__value--danger' : ''}`}>{card.value}</div>
              <div className="vc-stat__sub">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="vc-stack vc-stack--loose">
          {/* 调用趋势 */}
          <section className="vc-panel">
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={activityIcon} width={16} />
                    调用趋势
                  </span>
                </h2>
                <p className="vc-panel__desc">
                  {hours === 24 ? '按小时' : '按天'} · 红色数字为错误数
                </p>
              </div>
              <div className="vc-meta">总计 {overview?.calls.toLocaleString() ?? 0} 次</div>
            </div>
            {points.length === 0 ? (
              <EmptyState icon={barChartIcon} title="暂无调用数据" description="发出请求后这里会出现按小时聚合的曲线。" />
            ) : (
              <div className="vc-chart">
                {points.map((p, i) => {
                  const height = Math.max(2, (p.calls / maxCalls) * 120);
                  return (
                    <div key={`${p.time}-${i}`} className="vc-chart__col">
                      <div className={`vc-chart__err${p.errors > 0 ? ' has-error' : ''}`}>{p.errors > 0 ? p.errors : ''}</div>
                      <Tooltip
                        title={`${p.time} · 调用 ${p.calls} · 错误 ${p.errors} · P95 ${p.p95Ms}ms · Token ${p.tokens.toLocaleString()}`}
                        placement="top"
                      >
                        <div
                          className={`vc-chart__bar${p.errors > 0 ? ' has-error' : ''}`}
                          style={{ height }}
                        />
                      </Tooltip>
                      {(points.length <= 24 || i % Math.ceil(points.length / 12) === 0) && (
                        <div className="vc-chart__axis">{axisLabel(p.time)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 服务资源 */}
          <section className="vc-panel">
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={cpuIcon} width={16} />
                    服务资源占用
                  </span>
                </h2>
                <p className="vc-panel__desc">
                  {resource
                    ? `${resource.osName} · ${resource.cpuCores} 核 · ${resource.liveThreads} 线程 · JVM 已运行 ${fmtUptime(resource.jvmUptimeMs)}`
                    : '等待采样'}
                </p>
              </div>
            </div>
            {!resource ? (
              <EmptyState icon={cpuIcon} title="暂无资源数据" description="服务启动后每秒采样一次系统指标。" />
            ) : (
              <>
                <div className="vc-meter-grid">
                  {[
                    { label: '系统 CPU', pct: resource.systemCpuLoad, text: fmtPercent(resource.systemCpuLoad) },
                    { label: '进程 CPU', pct: resource.processCpuLoad, text: fmtPercent(resource.processCpuLoad) },
                    {
                      label: '物理内存',
                      pct: resource.memoryTotal > 0 ? resource.memoryUsed / resource.memoryTotal : -1,
                      text: `${fmtBytes(resource.memoryUsed)} / ${fmtBytes(resource.memoryTotal)}`,
                    },
                    {
                      label: 'JVM 堆',
                      pct: resource.heapMax > 0 ? resource.heapUsed / resource.heapMax : -1,
                      text: `${fmtBytes(resource.heapUsed)} / ${fmtBytes(resource.heapMax)}`,
                    },
                    {
                      label: '磁盘（数据目录）',
                      pct: resource.diskTotal > 0 ? resource.diskUsed / resource.diskTotal : -1,
                      text: `${fmtBytes(resource.diskUsed)} / ${fmtBytes(resource.diskTotal)}`,
                    },
                    {
                      label: 'Swap',
                      pct: resource.swapTotal > 0 ? resource.swapUsed / resource.swapTotal : -1,
                      text: resource.swapTotal > 0 ? `${fmtBytes(resource.swapUsed)} / ${fmtBytes(resource.swapTotal)}` : '未启用',
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="vc-meter__head">
                        <span className="vc-meter__label">{item.label}</span>
                        <span className="vc-meter__value">{item.text}</span>
                      </div>
                      <div className="vc-meter__track">
                        <div
                          className={`vc-meter__fill${item.pct > 0.85 ? ' vc-meter__fill--danger' : item.pct > 0.6 ? ' vc-meter__fill--warn' : ''}`}
                          style={{ width: `${item.pct < 0 ? 0 : Math.min(100, Math.max(0, item.pct * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="vc-meta" style={{ marginTop: 'var(--space-md)' }}>
                  数据目录 {resource.diskPath} · 采样 {resource.sampledAt} · 加载均值{' '}
                  {resource.systemLoadAverage < 0 ? '—' : resource.systemLoadAverage.toFixed(2)}
                </div>
              </>
            )}
          </section>

          {/* 接口排行 */}
          <section className="vc-panel vc-panel--flush vc-table-card">
            <SectionHead
              title="接口排行"
              desc="按调用量、错误数或 P95 排序，默认展示前 7 条"
              side={
                <Segmented
                  className="vc-segmented"
                  size="small"
                  value={endpointSort}
                  onChange={(v) => setEndpointSort(v as 'calls' | 'errors' | 'p95')}
                  options={[
                    { label: '按调用量', value: 'calls' },
                    { label: '按错误数', value: 'errors' },
                    { label: '按 P95', value: 'p95' },
                  ]}
                />
              }
            />
            <Table
              className="admin-table"
              rowKey={(r) => `${r.method}-${r.route}`}
              size="small"
              columns={endpointCols}
              dataSource={epRows.visible}
              pagination={false}
              locale={{ emptyText: '暂无接口调用' }}
            />
            <ListSentinel
              total={epRows.total}
              shown={epRows.visible.length}
              hasMore={epRows.hasMore}
              sentinelRef={epRows.sentinelRef}
            />
          </section>

          {/* LLM 用量 */}
          <section className="vc-panel vc-panel--flush vc-table-card">
            <SectionHead
              title="LLM 用量"
              desc="按模型聚合的调用、失败与延迟"
              side={
                <div className="vc-meta">
                  {llm ? `${llm.calls} 次 · ${llm.totalTokens.toLocaleString()} tokens · ${llm.errors} 次失败` : '—'}
                </div>
              }
            />
            <Table
              className="admin-table"
              rowKey={(r) => `${r.vendor}-${r.modelCode}`}
              size="small"
              columns={llmCols}
              dataSource={llm?.rows ?? []}
              pagination={false}
              locale={{ emptyText: '暂无 LLM 调用记录（发一次对话就会出现在这里）' }}
            />
          </section>

          {/* 在线会话 */}
          <section className="vc-panel vc-panel--flush vc-table-card">
            <SectionHead
              title={`在线会话（${onlineSessionCount}）`}
              desc={`共 ${sessions.length} 个活跃会话，在线优先 · 近 5 分钟有请求视为在线；下线后该 token 立即失效`}
              side={<div className="vc-meta">在线 {onlineSessionCount} / 共 {sessions.length}</div>}
            />
            <Table
              className="admin-table"
              rowKey="sid"
              size="small"
              columns={sessionCols}
              dataSource={sessRows.visible}
              pagination={false}
              locale={{ emptyText: '暂无会话' }}
            />
            <ListSentinel
              total={sessRows.total}
              shown={sessRows.visible.length}
              hasMore={sessRows.hasMore}
              sentinelRef={sessRows.sentinelRef}
            />
          </section>

          {/* 最近错误 */}
          <section className="vc-panel vc-panel--flush vc-table-card">
            <SectionHead
              title="最近错误"
              desc="业务码非 0 或 HTTP ≥ 400，按时间倒序"
              side={<div className="vc-meta">共 {errors.length} 条</div>}
            />
            <Table
              className="admin-table"
              rowKey="id"
              size="small"
              columns={errorCols}
              dataSource={errRows.visible}
              pagination={false}
              locale={{ emptyText: '没有错误，保持住' }}
            />
            <ListSentinel
              total={errRows.total}
              shown={errRows.visible.length}
              hasMore={errRows.hasMore}
              sentinelRef={errRows.sentinelRef}
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default MonitoringPage;
