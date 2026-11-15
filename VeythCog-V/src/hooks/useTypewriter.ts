import { useEffect, useRef, useState } from 'react';

/**
 * 打字机显示：把「已经到达的完整文本」按字符逐个吐出来。
 *
 * 为什么需要它：SSE 的 token 是成批到达的（可能是半个词、也可能一次几十个字符），
 * 直接把 content 铺到 DOM 上会「一顿一顿」地跳字。这里维护一个与内容长度解耦的
 * 播放进度（visibleLength），每帧按时间推进，于是：
 *   - 到达平稳 → 匀速打字；
 *   - 到达突发 → 加速追赶，但**至少用 ~1.4s 把一次积压吐完**，不会「啪」一下全糊上去；
 *   - 流结束 → 剩余少量字数照常吐完再停（不是瞬间对齐），只有积压过多时才直接落地。
 *
 * ⚠️ 两个已踩的坑：
 * 1) 取消 rAF 后必须把 ref 置空。否则 React StrictMode 的「mount → 卸载 → 再 mount」
 *    会先 cancel 掉帧、再被 `ref != null` 判成「已在跑」而提前 return，循环从此不重启，
 *    表现为整条回答一直空白、直到流结束才整段出现。
 * 2) 时长必须有下限。模型常常首 token 很慢（4~8s）、随后一整段瞬间到达，如果按
 *    「积压越多越快」无上限加速，用户看到的就是「等很久 → 一次性显示」。
 *
 * @param target    当前应显示的全部文本
 * @param active    是否正在流式（true = 逐字吐；false = 收尾/静态）
 * @param baseSpeed 基础速度（字/秒）
 */
export function useTypewriter(target: string, active: boolean, baseSpeed = 70) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [visibleLength, setVisibleLength] = useState(() => (active && !reducedMotion ? 0 : target.length));
  const lengthRef = useRef(active && !reducedMotion ? 0 : target.length);
  const targetRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const speedRef = useRef(baseSpeed);
  speedRef.current = baseSpeed;

  /** 取消排帧并清空句柄（两步都必须做，见文件头注释 1） */
  const stop = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  /** 直接对齐到全长（用于静态内容、重绘等场景） */
  const snap = () => {
    const full = targetRef.current.length;
    if (lengthRef.current !== full) {
      lengthRef.current = full;
      setVisibleLength(full);
    }
  };

  /** 启动吐字循环（已在跑则复用） */
  const start = () => {
    if (rafRef.current != null) return;
    let last = performance.now();
    let lastPaint = last;
    const tick = (now: number) => {
      const dt = Math.min(80, now - last);
      last = now;
      const backlog = targetRef.current.length - lengthRef.current;
      if (backlog <= 0) {
        rafRef.current = null;
        return;
      }
      // 基础速率打底；积压多则加速，但一次积压至少摊到 ~1.4s 内吐完（上限 500 字/秒）
      const speed = Math.max(speedRef.current, Math.min(500, backlog / 1.4));
      const step = Math.max(1, Math.round((speed * dt) / 1000));
      lengthRef.current = Math.min(targetRef.current.length, lengthRef.current + step);
      // 追平：立刻落地最后一帧（不受下面节流影响），否则会差最后几个字
      if (lengthRef.current >= targetRef.current.length) {
        setVisibleLength(lengthRef.current);
        rafRef.current = null;
        return;
      }
      // 每次 setState 都会让 Markdown 重新解析一遍，按 ~30fps 节流，长回复也不打满主线程
      if (now - lastPaint >= 32) {
        lastPaint = now;
        setVisibleLength(lengthRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    targetRef.current = target;

    // 内容被替换成更短的一截（重新生成 / 切换会话）→ 从头开始打
    if (lengthRef.current > target.length) {
      lengthRef.current = 0;
      setVisibleLength(0);
    }

    if (reducedMotion) {
      stop();
      snap();
      return;
    }

    const rest = target.length - lengthRef.current;
    if (!active) {
      // 收尾：只剩一小段就让循环照常吐完（避免最后几十个字瞬间跳出来）；
      // 积压过多（比如首次渲染就是整段历史内容）才直接对齐。
      if (rest > 0 && rest <= 200) {
        start();
        return;
      }
      stop();
      snap();
      return;
    }

    start();
  }, [target, active, reducedMotion]);

  useEffect(() => () => stop(), []);

  return {
    /** 当前该渲染的文本 */
    text: reducedMotion ? target : target.slice(0, visibleLength),
    /** 是否还在吐字（流式期间 + 收尾补字期间挂光标） */
    typing: !reducedMotion && (active || visibleLength < target.length),
  };
}

export default useTypewriter;
