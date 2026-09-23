import React, { useMemo, useState } from 'react';
import { Input } from 'antd';
import cronParser from 'cron-parser';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const CronExplainer: React.FC = () => {
  const { colors } = useTheme();
  const [expr, setExpr] = useState('*/5 * * * *');
  const [error, setError] = useState('');

  const info = useMemo(() => {
    setError('');
    try {
      // cron-parser 类型定义在不同版本下不一致，这里用 any 兼容
      const interval = (cronParser as any).parseExpression(expr, { currentDate: new Date() });
      const next5 = Array.from({ length: 5 }, () => interval.next().toDate());
      return { next5 };
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [expr]);

  const explain = (e: string): string => {
    const parts = e.trim().split(/\s+/);
    if (parts.length !== 5) return '标准 cron 是 5 段：分 时 日 月 周';
    const [m, h, dom, mon, dow] = parts;
    const map = (v: string, unit: string) => {
      if (v === '*') return `每${unit}`;
      if (v.startsWith('*/')) return `每 ${v.slice(2)} ${unit}`;
      if (v.includes(',')) return `${unit}：${v}（多个值）`;
      if (v.includes('-')) return `${unit} ${v}（范围）`;
      return `${unit} ${v}`;
    };
    return [map(m, '分钟'), map(h, '小时'), map(dom, '日'), map(mon, '月'), map(dow, '周几')].join('，');
  };

  return (
    <ToolShell title="Cron 解释" description="把表达式翻译成中文，预览未来 5 次执行时间">
      <Input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="*/5 * * * *"
        style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", marginBottom: 16 }}
      />
      {error && <div style={{ color: colors.error, fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {info && (
        <>
          <div
            style={{
              padding: 16,
              background: colors.primary10,
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {explain(expr)}
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>未来 5 次执行时间</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {info.next5.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: "'JetBrains Mono', Consolas, monospace",
                  fontSize: 13,
                }}
              >
                #{i + 1}  {d.toLocaleString('zh-CN')}
              </div>
            ))}
          </div>
        </>
      )}
    </ToolShell>
  );
};

export default CronExplainer;
