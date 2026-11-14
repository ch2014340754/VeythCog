import React from 'react';

/**
 * 底部文案栏：写死 5 条，5s 轮播。
 * 配色/阴影交给 .vc-quote（含 body.has-bg 壁纸白字变体）。
 */
const QUOTES = [
  '「岁至立冬，万物开始一场静默的修行。」',
  '「星光不问赶路人，时光不负有心人。」',
  '「日拱一卒，功不唐捐。」',
  '「把每一个平凡的日子过成不平凡的日子。」',
  '「路虽远行则将至，事虽难做则必成。」',
];

const QuoteBar: React.FC = () => {
  const [idx, setIdx] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return <div className="vc-quote">{QUOTES[idx]}</div>;
};

export default QuoteBar;
