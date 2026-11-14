import React from 'react';

/**
 * 大时钟 + 公历日期 + 星期。
 * 配色/阴影全部交给 .vc-clock（含 body.has-bg 壁纸白字变体），组件只负责时间。
 */
const Clock: React.FC = () => {
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`;

  return (
    <div className="vc-clock">
      <div className="vc-clock__time">
        {hh}:{mm}
      </div>
      <div className="vc-clock__date">{dateStr}</div>
    </div>
  );
};

export default Clock;
