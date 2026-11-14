import React, { useMemo, useState } from 'react';
import { Input } from 'antd';
import cronParser from 'cron-parser';
import ToolShell from '../ToolShell';

const CronExplainer: React.FC = () => {
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
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div className="vc-field-label">表达式</div>
        <Input
          className="vc-mono-input"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="*/5 * * * *"
        />
      </div>

      {error && <div className="vc-tool-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

      {info && (
        <>
          <div className="vc-panel" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">含义</h2>
                <p className="vc-panel__desc">按「分 时 日 月 周」逐段解释。</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--color-text)' }}>{explain(expr)}</p>
          </div>

          <div className="vc-panel">
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">未来 5 次执行时间</h2>
              </div>
            </div>
            <div className="vc-stack vc-stack--tight">
              {info.next5.map((d, i) => (
                <div key={i} className="vc-hash-row" style={{ gridTemplateColumns: '48px minmax(0, 1fr)' }}>
                  <span className="vc-hash-row__algo">#{i + 1}</span>
                  <span className="vc-hash-row__value">{d.toLocaleString('zh-CN')}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </ToolShell>
  );
};

export default CronExplainer;
