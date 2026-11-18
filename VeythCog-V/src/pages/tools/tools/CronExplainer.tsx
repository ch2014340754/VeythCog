import React, { useMemo, useState } from 'react';
import { Input } from 'antd';
import { CronExpressionParser } from 'cron-parser';
import ToolShell from '../ToolShell';

const CronExplainer: React.FC = () => {
  const [expr, setExpr] = useState('*/5 * * * *');

  const result = useMemo(() => {
    try {
      // cron-parser 5.x 用 CronExpressionParser.parse 取代了 4.x 的 parseExpression
      const interval = CronExpressionParser.parse(expr, { currentDate: new Date() });
      const next5 = Array.from({ length: 5 }, () => interval.next().toDate());
      return { next5, error: '' };
    } catch (e: any) {
      return { next5: null, error: e?.message || '表达式解析失败' };
    }
  }, [expr]);

  const explain = (e: string): string => {
    const parts = e.trim().split(/\s+/);
    if (parts.length !== 5 && parts.length !== 6) {
      return '标准 cron 是 5 段（分 时 日 月 周），cron-parser 5.x 也支持 6 段（秒 分 时 日 月 周）';
    }
    const units = parts.length === 6
      ? ['秒', '分钟', '小时', '日', '月', '周几']
      : ['分钟', '小时', '日', '月', '周几'];
    const map = (v: string, unit: string) => {
      if (v === '*') return `每${unit}`;
      if (v.startsWith('*/')) return `每 ${v.slice(2)} ${unit}`;
      if (v.includes(',')) return `${unit}：${v}（多个值）`;
      if (v.includes('-')) return `${unit} ${v}（范围）`;
      return `${unit} ${v}`;
    };
    return parts.map((v, i) => map(v, units[i])).join('，');
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

      {result.error && <div className="vc-tool-error" style={{ marginBottom: 'var(--space-md)' }}>{result.error}</div>}

      {result.next5 && (
        <>
          <div className="vc-panel" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">含义</h2>
                <p className="vc-panel__desc">按「分 时 日 月 周」（6 段时含秒）逐段解释。</p>
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
              {result.next5.map((d, i) => (
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
