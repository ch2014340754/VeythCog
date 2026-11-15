/**
 * 指针聚光（pointer glow）
 * ------------------------------------------------------------
 * 两种目标，两种脾气：
 *
 * 1) 卡片（`.vc-bookmark`）——像一粒粒开关：靠近哪张哪张亮，离开就熄。
 *    强度 = smoothstep(离边缘的距离 / 半径)，没有基线。
 *
 * 2) 面板（内页 `.vc-panel`、弹窗 `.ant-modal-content`）——像登录页那张表单卡：
 *    借鉴 `Login/index.tsx` 的算法，**永远带一点微光（0.32）**，越靠近越亮到 1，
 *    方位角用缓动（0.18/帧）跟着指针转，所以看上去是"光在边框上流动"，
 *    而不是"一闪一灭"。
 *
 * 首屏（首页图标墙）只有第 1 种：那一整块网格容器是固定 4 行高的，
 * 框上去会在空白区画出一个大空盒子，反而抢戏 —— 所以不把它当面板。
 * 卡片上的"编辑/删除"按钮也已经去掉，改走全局右键菜单。
 *
 * 只写两个自定义属性，画法全交给 CSS：
 *   --glow（0~1）、--glow-angle（deg）
 *
 * 性能：全局 pointermove → 一帧一次 rAF；矩形只在 resize/scroll/DOM 变动时重建；
 *      写样式有阈值；缓动到位后 rAF 停掉（不常驻空转）。
 */
const CARD_SELECTOR = '.vc-bookmark';
/** 面板：内页分区 + 弹窗。`.vc-stat` 有自己的脉搏与扫光，不参与（伪元素会打架） */
const SURFACE_SELECTOR = '.vc-panel:not(.vc-stat), .ant-modal .ant-modal-content';
/** 导航栏（左 rail / 右分类栏）：按钮区上一团跟着鼠标走的聚光 */
const RAIL_SELECTOR = '.vc-rail, .vc-catnav';

/** 卡片：多远还能感觉到（px） */
const CARD_RADIUS = 130;

/** 面板：多远还能感觉到（px）；面板越大越宽，衰减也越长 */
const SURFACE_RADIUS = 440;

/** 面板常亮的底光（登录表单卡同款：远处也有一层很淡的光） */
const SURFACE_FLOOR = 0.32;

/** rail：指针出栏后多少 px 内渐隐（栏很窄，出栏立刻熄灭会很生硬） */
const RAIL_FADE = 40;

const T_EPS = 0.015;
const A_EPS = 3;
/** 缓动系数与收敛阈值（面板用） */
const EASE = 0.18;
const EASE_SETTLED = 0.004;

interface GlowItem {
  el: HTMLElement;
  kind: 'card' | 'surface' | 'rail';
  rect: DOMRect | null;
  lastT: number;
  lastA: number;
  /** rail 用：上一次写入的光斑坐标（元素内 px） */
  lastX: number;
  lastY: number;
  /** rail 用：当前被指针压住的那颗按钮（换颗按钮时要把上一颗的高光收掉） */
  activeBtn: HTMLElement | null;
  btnX: number;
  btnY: number;
  /** 面板用：缓动中的当前值 */
  curT: number;
  curA: number;
  targetT: number;
  targetA: number;
}

let items: GlowItem[] = [];
let dirty = true;
let rafId = 0;
let pointerX = -9999;
let pointerY = -9999;
let started = false;
/** 减弱动效时不做补间（直接跳到位），否则"光圈慢慢挪"本身就算动效 */
let easeFactor = EASE;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function makeItem(el: HTMLElement, kind: 'card' | 'surface' | 'rail', prev?: GlowItem): GlowItem {
  return {
    el,
    kind,
    rect: null,
    lastT: prev ? prev.lastT : -1,
    lastA: prev ? prev.lastA : -1,
    lastX: prev ? prev.lastX : -9999,
    lastY: prev ? prev.lastY : -9999,
    activeBtn: prev ? prev.activeBtn : null,
    btnX: prev ? prev.btnX : -9999,
    btnY: prev ? prev.btnY : -9999,
    curT: prev ? prev.curT : kind === 'surface' ? SURFACE_FLOOR : 0,
    curA: prev ? prev.curA : 210,
    targetT: kind === 'surface' ? SURFACE_FLOOR : 0,
    targetA: 210,
  };
}

function collect(): GlowItem[] {
  const next: GlowItem[] = [];
  const seen = new Set<HTMLElement>();

  document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((el) => {
    seen.add(el);
    next.push(makeItem(el, 'card', items.find((i) => i.el === el)));
  });

  document.querySelectorAll<HTMLElement>(SURFACE_SELECTOR).forEach((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    // 只认真正画得出来的（弹窗关闭后 AntD 会留下 display:none 的节点）
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
    next.push(makeItem(el, 'surface', items.find((i) => i.el === el)));
  });

  document.querySelectorAll<HTMLElement>(RAIL_SELECTOR).forEach((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    next.push(makeItem(el, 'rail', items.find((i) => i.el === el)));
  });

  items.forEach((i) => {
    if (!next.some((n) => n.el === i.el)) i.el.style.setProperty('--glow', '0');
  });

  return next;
}

function refresh() {
  items = collect();
  for (const it of items) it.rect = it.el.getBoundingClientRect();

  // 指针还没动过时，面板先露出那一层底光（否则首屏一片死平，要等鼠标挪一下才亮）
  if (pointerX < -9000) {
    items.forEach((it) => {
      if (it.kind === 'surface') apply(it, SURFACE_FLOOR, it.targetA);
    });
  }

  dirty = false;
}

/** 角度差折算到 (-180, 180]，缓动才不会绕远路 */
function angleDelta(from: number, to: number): number {
  let d = ((to - from) % 360 + 540) % 360 - 180;
  return d;
}

function apply(it: GlowItem, t: number, angle: number) {
  if (Math.abs(t - it.lastT) < T_EPS && Math.abs(angleDelta(it.lastA, angle)) < A_EPS) return;
  it.lastT = t;
  it.lastA = angle;
  if (t <= 0) {
    it.el.style.setProperty('--glow', '0');
    return;
  }
  it.el.style.setProperty('--glow', t.toFixed(3));
  it.el.style.setProperty('--glow-angle', `${angle.toFixed(1)}deg`);
}

/** rail 聚光：写强度 + 光斑坐标（有阈值，避免每帧都刷样式） */
function writeRail(it: GlowItem, t: number, x: number, y: number) {
  if (Math.abs(t - it.lastT) < T_EPS && Math.abs(x - it.lastX) < 1 && Math.abs(y - it.lastY) < 1) return;
  it.lastT = t;
  it.lastX = x;
  it.lastY = y;
  it.el.style.setProperty('--glow', t.toFixed(3));
  it.el.style.setProperty('--glow-x', `${x.toFixed(0)}px`);
  it.el.style.setProperty('--glow-y', `${y.toFixed(0)}px`);
}

/** rail 里被指针压住的按钮：写 --btn-glow / --btn-x / --btn-y（元素内 px） */
function highlightButton(it: GlowItem, x: number, y: number) {
  let target: HTMLElement | null = null;

  if (x > -9000) {
    for (const btn of it.el.querySelectorAll<HTMLElement>('.vc-rail__btn, .vc-catnav__item')) {
      const br = btn.getBoundingClientRect();
      if (x >= br.left && x <= br.right && y >= br.top && y <= br.bottom) {
        target = btn;
        const bx = x - br.left;
        const by = y - br.top;
        if (Math.abs(bx - it.btnX) >= 1 || Math.abs(by - it.btnY) >= 1 || it.activeBtn !== btn) {
          it.btnX = bx;
          it.btnY = by;
          btn.style.setProperty('--btn-glow', '1');
          btn.style.setProperty('--btn-x', `${bx.toFixed(0)}px`);
          btn.style.setProperty('--btn-y', `${by.toFixed(0)}px`);
        }
        break;
      }
    }
  }

  if (it.activeBtn && it.activeBtn !== target) {
    it.activeBtn.style.setProperty('--btn-glow', '0');
  }
  it.activeBtn = target;
}

function outsideDistance(r: DOMRect, x: number, y: number): number {
  const ox = Math.max(r.left - x, 0, x - r.right);
  const oy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(ox, oy);
}

/** 卡片：靠多近决定多亮（无基线） */
function cardTarget(it: GlowItem): { t: number; a: number } {
  const r = it.rect!;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = pointerX - cx;
  const dy = pointerY - cy;
  let t = 1 - outsideDistance(r, pointerX, pointerY) / CARD_RADIUS;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  t = t * t * (3 - 2 * t);
  return { t, a: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 };
}

/** 面板：常亮微光 + 越靠近边缘越亮（宽面板用「离边缘」而不是「离中心」，否则左右两端永远点不亮） */
function surfaceTarget(it: GlowItem): { t: number; a: number } {
  const r = it.rect!;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = pointerX - cx;
  const dy = pointerY - cy;

  let t = 1 - outsideDistance(r, pointerX, pointerY) / SURFACE_RADIUS;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  t = t * t * (3 - 2 * t);
  t = Math.max(SURFACE_FLOOR, t);

  return { t, a: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 };
}

function frame() {
  rafId = 0;
  if (dirty) refresh();

  let unsettled = false;

  for (const it of items) {
    const r = it.rect;
    if (!r || r.width === 0 || r.height === 0) {
      apply(it, 0, it.lastA);
      continue;
    }

    if (it.kind === 'rail') {
      // 聚光：坐标用元素内 px（CSS 里直接 at var(--glow-x) var(--glow-y)）；
      // 指针在栏内满亮，出栏 40px 内渐隐，避免贴着栏挪动时忽明忽暗
      if (pointerX < -9000) {
        writeRail(it, 0, it.lastX, it.lastY);
        highlightButton(it, -9999, -9999);
        continue;
      }
      const out = outsideDistance(r, pointerX, pointerY);
      const t = out === 0 ? 1 : Math.max(0, 1 - out / RAIL_FADE);
      const lx = Math.min(Math.max(pointerX - r.left, 0), r.width);
      const ly = Math.min(Math.max(pointerY - r.top, 0), r.height);
      writeRail(it, t, lx, ly);
      // 被指针压住的那颗按钮再单独打一层内侧高光（换颗按钮时把上一颗收掉）
      highlightButton(it, pointerX, pointerY);
      continue;
    }

    if (it.kind === 'card') {
      // 视野外就不必算
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (
        Math.abs(pointerX - cx) > r.width / 2 + CARD_RADIUS ||
        Math.abs(pointerY - cy) > r.height / 2 + CARD_RADIUS
      ) {
        apply(it, 0, it.lastA);
        continue;
      }
      const next = cardTarget(it);
      apply(it, next.t, next.a);
      continue;
    }

    // 面板：先算目标，再缓动逼近
    const next = surfaceTarget(it);
    it.targetT = next.t;
    it.targetA = next.a;

    it.curT += (it.targetT - it.curT) * easeFactor;
    it.curA += angleDelta(it.curA, it.targetA) * easeFactor;

    if (Math.abs(it.targetT - it.curT) > EASE_SETTLED || Math.abs(angleDelta(it.curA, it.targetA)) > 0.6) {
      unsettled = true;
    }

    apply(it, it.curT, ((it.curA % 360) + 360) % 360);
  }

  // 缓动还没到位就继续跑；到位后自然停，不空转
  if (unsettled) rafId = requestAnimationFrame(frame);
}

function schedule() {
  if (rafId) return;
  rafId = requestAnimationFrame(frame);
}

function onPointerMove(e: PointerEvent) {
  pointerX = e.clientX;
  pointerY = e.clientY;
  schedule();
}

function onPointerLeave() {
  pointerX = -9999;
  pointerY = -9999;
  schedule();
}

function invalidate() {
  dirty = true;
  schedule();
}

export function installPointerGlow(): () => void {
  if (started) return () => undefined;
  started = true;
  easeFactor = prefersReducedMotion() ? 1 : EASE;

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('blur', onPointerLeave);
  window.addEventListener('resize', invalidate);
  window.addEventListener('scroll', invalidate, { passive: true, capture: true });

  const mo = new MutationObserver(invalidate);
  mo.observe(document.body, { childList: true, subtree: true });

  invalidate();

  return () => {
    started = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerMove);
    document.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('blur', onPointerLeave);
    window.removeEventListener('resize', invalidate);
    window.removeEventListener('scroll', invalidate, true);
    mo.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    items.forEach((i) => {
      i.el.style.setProperty('--glow', '0');
      i.activeBtn?.style.setProperty('--btn-glow', '0');
    });
    items = [];
  };
}
