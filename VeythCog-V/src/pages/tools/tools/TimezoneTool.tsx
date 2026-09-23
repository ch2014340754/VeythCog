import React, { useState } from 'react';
import { Select } from 'antd';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { colors } = useTheme();
  const [zone1, setZone1] = useState('Asia/Shanghai');
  const [zone2, setZone2] = useState('America/Los_Angeles');
  const [now] = useState(() => new Date());

  return (
    <ToolShell title="时区转换" description="选两个时区，实时对照当前时间">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ padding: 20, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-lg)' }}>
          <Select
            value={zone1}
            onChange={setZone1}
            showSearch
            style={{ width: '100%', marginBottom: 12 }}
            options={COMMON_ZONES.map((z) => ({ value: z, label: z }))}
          />
          <div style={{ fontSize: 28, fontFamily: "'JetBrains Mono', Consolas, monospace", fontWeight: 700, color: colors.primary }}>
            {formatInZone(now, zone1)}
          </div>
        </div>
        <div style={{ padding: 20, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 'var(--radius-lg)' }}>
          <Select
            value={zone2}
            onChange={setZone2}
            showSearch
            style={{ width: '100%', marginBottom: 12 }}
            options={COMMON_ZONES.map((z) => ({ value: z, label: z }))}
          />
          <div style={{ fontSize: 28, fontFamily: "'JetBrains Mono', Consolas, monospace", fontWeight: 700, color: colors.primary }}>
            {formatInZone(now, zone2)}
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default TimezoneTool;
