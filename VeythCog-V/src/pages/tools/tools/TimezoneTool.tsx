import React, { useState } from 'react';
import { Select } from 'antd';
import ToolShell from '../ToolShell';

const COMMON_ZONES = [
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Dubai',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

function formatInZone(date: Date, zone: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date);
}

const TimezoneTool: React.FC = () => {
  const [zone1, setZone1] = useState('Asia/Shanghai');
  const [zone2, setZone2] = useState('America/Los_Angeles');
  const [now] = useState(() => new Date());

  const card = (zone: string, setZone: (z: string) => void, label: string) => (
    <div className="vc-panel">
      <div className="vc-panel__head">
        <div>
          <h2 className="vc-panel__title">{label}</h2>
          <p className="vc-panel__desc">选择时区后实时换算。</p>
        </div>
      </div>
      <Select
        value={zone}
        onChange={setZone}
        showSearch
        style={{ width: '100%', marginBottom: 'var(--space-md)' }}
        options={COMMON_ZONES.map((z) => ({ value: z, label: z }))}
      />
      <div className="vc-clock-value">{formatInZone(now, zone)}</div>
    </div>
  );

  return (
    <ToolShell title="时区转换" description="选两个时区，实时对照当前时间">
      <div className="vc-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {card(zone1, setZone1, '时区 A')}
        {card(zone2, setZone2, '时区 B')}
      </div>
    </ToolShell>
  );
};

export default TimezoneTool;
