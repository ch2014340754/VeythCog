import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Popconfirm, Segmented, Space, Spin, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Icon } from '@iconify/react';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import activityIcon from '@iconify-icons/lucide/activity';
import cpuIcon from '@iconify-icons/lucide/cpu';
import { useTheme } from '@/contexts/ThemeContext';
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
/** 接口排行、在线会话、最近错误默认只展示前 7 行 */
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

/** 表格底部的「查看更多 / 收起」入口 */
const MoreRows: React.FC<{
  total: number;
  expanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ total, expanded, onToggle, colors }) => {
  if (total <= PREVIEW_ROWS) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
      <Button type="link" size="small" onClick={onToggle} style={{ fontSize: 12, color: colors.primary }}>
        {expanded ? '收起' : `查看更多（还有 ${total - PREVIEW_ROWS} 条）`}
      </Button>
    </div>
  );
};

const MonitoringPage: React.FC = () => {
  const { colors } = useTheme();
  const [hours, setHours] = useState(24);
  const [overview, setOverview] = useState<MonitorOverview | null>(null);
  const [points, setPoints] = useState<MonitorPoint[]>([]);
  const [endpoints, setEndpoints] = useState<MonitorEndpoint[]>([]);
  const [endpointSort, setEndpointSort] = useState<'calls' | 'errors' | 'p95'>('calls');
  const [errors, setErrors] = useState<MonitorError[]>([]);
  const [llm, setLlm] = useState<MonitorLlmSummary | null>(null);
  const [sessions, setSessions] = useState<MonitorSession[]>([]);
  const [resource, setResource] = useState<MonitorResource | null>(null);
  const [showAllEndpoints, setShowAllEndpoints] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
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

  const visibleEndpoints = showAllEndpoints ? endpoints : endpoints.slice(0, PREVIEW_ROWS);
  const visibleSessions = showAllSessions ? orderedSessions : orderedSessions.slice(0, PREVIEW_ROWS);
  const visibleErrors = showAllErrors ? errors : errors.slice(0, PREVIEW_ROWS);

  const endpointCols: ColumnsType<MonitorEndpoint> = [
    {
      title: '接口',
      dataIndex: 'route',
      render: (_, r) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
          <Tag style={{ marginRight: 6 }}>{r.method}</Tag>
          {r.route}
        </span>
      ),
    },
    { title: '调用', dataIndex: 'calls', width: 80, align: 'right', render: (v: number) => v.toLocaleString() },
    {
      title: '错误',
      dataIndex: 'errors',
      width: 110,
      align: 'right',
      render: (v: number, r) => (
        <span>
          {v > 0 ? <span style={{ color: '#ef4444' }}>{v}</span> : <span style={{ color: colors.textTertiary }}>0</span>}
          <span style={{ color: colors.textTertiary, fontSize: 11 }}> / {fmtPercent(r.errorRate)}</span>
        </span>
      ),
    },
    { title: '平均', dataIndex: 'avgCostMs', width: 90, align: 'right', render: (v: number) => `${v} ms` },
    {
      title: 'P95',
      dataIndex: 'p95Ms',
      width: 90,
      align: 'right',
      render: (v: number) => <strong>{v} ms</strong>,
    },
    { title: '最大', dataIndex: 'maxCostMs', width: 90, align: 'right', render: (v: number) => `${v} ms` },
  ];

  const errorCols: ColumnsType<MonitorError> = [
    { title: '时间', dataIndex: 'time', width: 160 },
    {
      title: '接口',
      dataIndex: 'route',
      width: 220,
      render: (_, r) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
          <Tag style={{ marginRight: 6 }}>{r.method}</Tag>
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
      render: (v: string) => <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: colors.textTertiary }}>{v}</span>,
    },
  ];

  const llmCols: ColumnsType<MonitorLlmSummary['rows'][number]> = [
    {
      title: '模型',
      dataIndex: 'modelCode',
      render: (_, r) => (
        <span>
          <Tag>{r.vendor}</Tag>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{r.modelCode}</span>
        </span>
      ),
    },
    { title: '调用', dataIndex: 'calls', width: 80, align: 'right', render: (v: number) => v.toLocaleString() },
    {
      title: '失败',
      dataIndex: 'errors',
      width: 80,
      align: 'right',
      render: (v: number) => (v > 0 ? <span style={{ color: '#ef4444' }}>{v}</span> : '0'),
    },
    {
      title: 'Token（输入 / 输出）',
      dataIndex: 'totalTokens',
      width: 210,
      align: 'right',
      render: (_, r) => (
        <Tooltip title={`输入 ${r.promptTokens.toLocaleString()} · 输出 ${r.completionTokens.toLocaleString()}`}>
          <span>{r.totalTokens.toLocaleString()}</span>
        </Tooltip>
      ),
    },
    { title: '平均延迟', dataIndex: 'avgLatencyMs', width: 100, align: 'right', render: (v: number) => `${v} ms` },
    { title: '最大延迟', dataIndex: 'maxLatencyMs', width: 100, align: 'right', render: (v: number) => `${v} ms` },
  ];

  const sessionCols: ColumnsType<MonitorSession> = [
    {
      title: '用户',
      dataIndex: 'username',
      render: (_, r) => (
        <span>
          {r.nickname || r.username}
          <span style={{ color: colors.textTertiary, fontSize: 11 }}> @{r.username}</span>
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
          <span style={{ fontSize: 11, color: colors.textSecondary }}>{v || '—'}</span>
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

  if (loading && !overview) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon icon={activityIcon} width={18} />
            系统监控
          </h2>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
            调用量、失败率、耗时、Token、会话与服务资源，全部来自真实采集。
            <span style={{ color: colors.textTertiary }}> · {updatedAt ? `更新于 ${updatedAt.toLocaleTimeString('zh-CN')}` : '加载中'}</span>
          </p>
        </div>
        <Space>
          <Segmented
            value={hours}
            onChange={(v) => {
              setHours(v as number);
              setShowAllEndpoints(false);
              setShowAllErrors(false);
            }}
            options={[
              { label: '近 24 小时', value: 24 },
              { label: '近 7 天', value: 168 },
            ]}
          />
          <Button icon={<Icon icon={refreshIcon} width={15} />} onClick={() => void load(true)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 概览卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        {stats.map((card) => (
          <div
            key={card.label}
            className="admin-panel"
            style={{
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.danger ? '#ef4444' : colors.primary }}>{card.value}</div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 调用趋势 */}
      <section
        className="admin-panel"
        style={{
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            调用趋势
            <span style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 8 }}>
              {hours === 24 ? '按小时' : '按天'} · 红色数字为错误数
            </span>
          </div>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>总计 {overview?.calls.toLocaleString() ?? 0} 次</span>
        </div>
        {points.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无调用数据" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180 }}>
            {points.map((p, i) => {
              const height = Math.max(2, (p.calls / maxCalls) * 120);
              return (
                <div key={`${p.time}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: p.errors > 0 ? '#ef4444' : colors.textTertiary, height: 14 }}>
                    {p.errors > 0 ? p.errors : ''}
                  </div>
                  <Tooltip
                    title={`${p.time} · 调用 ${p.calls} · 错误 ${p.errors} · P95 ${p.p95Ms}ms · Token ${p.tokens.toLocaleString()}`}
                    placement="top"
                  >
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 34,
                        height,
                        background: p.errors > 0 ? `${colors.primary}` : colors.primary,
                        opacity: p.errors > 0 ? 0.95 : 0.75,
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  </Tooltip>
                  {(points.length <= 24 || i % Math.ceil(points.length / 12) === 0) && (
                    <div style={{ fontSize: 10, color: colors.textSecondary, whiteSpace: 'nowrap' }}>{axisLabel(p.time)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 服务资源 */}
      <section
        className="admin-panel"
        style={{
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon icon={cpuIcon} width={15} />
            服务资源占用
          </div>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {resource ? `${resource.osName} · ${resource.cpuCores} 核 · ${resource.liveThreads} 线程 · JVM 已运行 ${fmtUptime(resource.jvmUptimeMs)}` : '—'}
          </span>
        </div>
        {!resource ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资源数据" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: colors.textSecondary }}>{item.label}</span>
                  <span style={{ color: colors.textTertiary }}>{item.text}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: colors.border, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.pct < 0 ? 0 : Math.min(100, Math.max(0, item.pct * 100))}%`,
                      height: '100%',
                      background: item.pct > 0.85 ? '#ef4444' : item.pct > 0.6 ? '#f59e0b' : colors.primary,
                      transition: 'width .3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {resource && (
          <div style={{ marginTop: 12, fontSize: 11, color: colors.textTertiary }}>
            数据目录 {resource.diskPath} · 采样 {resource.sampledAt} · 加载均值 {resource.systemLoadAverage < 0 ? '—' : resource.systemLoadAverage.toFixed(2)}
          </div>
        )}
      </section>

      {/* 接口排行 */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>接口排行</div>
          <Segmented
            size="small"
            value={endpointSort}
            onChange={(v) => {
              setEndpointSort(v as 'calls' | 'errors' | 'p95');
              setShowAllEndpoints(false);
            }}
            options={[
              { label: '按调用量', value: 'calls' },
              { label: '按错误数', value: 'errors' },
              { label: '按 P95', value: 'p95' },
            ]}
          />
        </div>
        <Table
          className="admin-table"
          rowKey={(r) => `${r.method}-${r.route}`}
          size="small"
          columns={endpointCols}
          dataSource={visibleEndpoints}
          pagination={false}
          locale={{ emptyText: '暂无接口调用' }}
        />
        <MoreRows
          total={endpoints.length}
          expanded={showAllEndpoints}
          onToggle={() => setShowAllEndpoints((v) => !v)}
          colors={colors}
        />
      </section>

      {/* LLM 用量 */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>LLM 用量</div>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {llm ? `${llm.calls} 次 · ${llm.totalTokens.toLocaleString()} tokens · ${llm.errors} 次失败` : ''}
          </span>
        </div>
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
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>在线会话（{onlineSessionCount}）</div>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            共 {sessions.length} 个活跃会话，在线优先 · 近 5 分钟有请求视为在线；下线后该 token 立即失效
          </span>
        </div>
        <Table
          className="admin-table"
          rowKey="sid"
          size="small"
          columns={sessionCols}
          dataSource={visibleSessions}
          pagination={false}
          locale={{ emptyText: '暂无会话' }}
        />
        <MoreRows
          total={orderedSessions.length}
          expanded={showAllSessions}
          onToggle={() => setShowAllSessions((v) => !v)}
          colors={colors}
        />
      </section>

      {/* 最近错误 */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>最近错误</div>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>业务码非 0 或 HTTP ≥ 400，按时间倒序</span>
        </div>
        <Table
          className="admin-table"
          rowKey="id"
          size="small"
          columns={errorCols}
          dataSource={visibleErrors}
          pagination={false}
          locale={{ emptyText: '没有错误，保持住' }}
        />
        <MoreRows
          total={errors.length}
          expanded={showAllErrors}
          onToggle={() => setShowAllErrors((v) => !v)}
          colors={colors}
        />
      </section>
    </div>
  );
};

export default MonitoringPage;
