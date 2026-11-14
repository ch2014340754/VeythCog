import React, { useState } from 'react';
import { Button, Slider, message } from 'antd';
import ToolShell from '../ToolShell';

const UuidTool: React.FC = () => {
  const [count, setCount] = useState(10);
  const [uuids, setUuids] = useState<string[]>([]);

  const gen = () => {
    const arr = Array.from({ length: count }, () => crypto.randomUUID());
    setUuids(arr);
  };

  const copyOne = (u: string) => {
    navigator.clipboard.writeText(u);
    message.success('已复制');
  };

  return (
    <ToolShell
      title="UUID 生成"
      description="批量生成 v4 UUID，点任意一个即可复制"
      actions={
        <div className="vc-toolbar" style={{ padding: 0, border: 'none', background: 'transparent' }}>
          <span className="vc-meta">数量</span>
          <Slider min={1} max={100} value={count} onChange={setCount} style={{ width: 120 }} />
          <span className="vc-num" style={{ minWidth: 24, color: 'var(--color-text-secondary)' }}>{count}</span>
          <Button type="primary" onClick={gen}>
            生成
          </Button>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(uuids.join('\n'));
              message.success('已复制全部');
            }}
            disabled={!uuids.length}
          >
            复制全部
          </Button>
        </div>
      }
    >
      {uuids.length ? (
        <div className="vc-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {uuids.map((u, i) => (
            <button
              key={i}
              className="vc-card vc-card--interactive"
              onClick={() => copyOne(u)}
              style={{ textAlign: 'left', fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
            >
              {u}
            </button>
          ))}
        </div>
      ) : (
        <div className="vc-meta">选好数量后点「生成」。</div>
      )}
    </ToolShell>
  );
};

export default UuidTool;
