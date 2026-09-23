/**
 * 将 timestamp 格式化为相对时间字符串（低调显示）
 - 超过30天显示 "M月D日"
 - 7~30天显示 "N天前"
 - 1~7天显示 "N天前"
 - 今天显示 "HH:mm"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const MINUTE = 60_000;
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  if (diff < 0) return '刚刚';

  // 今天
  if (diff < DAY) {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // 1~7天
  if (diff < 7 * DAY) {
    return `${Math.floor(diff / DAY)}天前`;
  }

  // 7~30天
  if (diff < 30 * DAY) {
    return `${Math.floor(diff / DAY)}天前`;
  }

  // 趞30天显示日期
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}