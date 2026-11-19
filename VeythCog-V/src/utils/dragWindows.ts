/**
 * 全站弹窗拖拽。
 *
 * 居中由样式统一负责（styles/page.css 里把所有 .ant-modal 变成 centered 布局），
 * 这里只解决「拖得住」：注册一次，对 antd Modal（含 Modal.confirm / Modal.info 这类
 * 静态调用出来的确认弹窗）、待办浮窗、音乐选择器都生效，业务组件不必各自实现。
 *
 * 位移写在 CSS 变量 --vc-drag-x / --vc-drag-y 上，由样式里的 transform 读取，
 * 因此不会覆盖各弹层自身的 transform（antd 的入场缩放动画等）。
 */

/** 可以被拖动整个窗口的容器 */
const HOSTS = ['.ant-modal', '.vc-todopanel', '[data-drag-host]'];

/** 视为「把手」的区域：按住这些地方才拖，避免在正文/输入框里误触发 */
const HANDLES = [
  '.ant-modal-header',
  '.ant-modal-confirm-title',
  '.vc-todopanel__head',
  '.vc-picker__head',
  '.vc-modal-head__title',
  '[data-drag-handle]',
];

/** 把手内部的交互元素不参与拖拽 */
const IGNORES = 'button, a, input, textarea, select, [contenteditable="true"], .ant-modal-close';

const HOST_SELECTOR = HOSTS.join(',');
const HANDLE_SELECTOR = HANDLES.join(',');

/** 拖到边缘时至少保留这么多像素在视口内，避免窗口被拖丢 */
const KEEP_VISIBLE = 96;

interface DragState {
  host: HTMLElement;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  rect: DOMRect;
}

let state: DragState | null = null;

/** 已经挂过「重开归位」监听的弹窗，避免重复观察 */
const watchedHosts = new WeakSet<HTMLElement>();

function readOffset(host: HTMLElement, name: string): number {
  const raw = host.style.getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/** 把窗口放回居中：清掉累积的位移 */
function resetOffset(host: HTMLElement) {
  host.style.removeProperty('--vc-drag-x');
  host.style.removeProperty('--vc-drag-y');
}

/**
 * antd Modal 会复用同一份 DOM：关闭只是把 .ant-modal-wrap 的 display 置为 none，
 * 开合过程会在 .ant-modal 上挂 / 摘 ant-zoom-* 动画类。
 * 一旦这个弹窗被拖过，就盯住这两处信号，重新打开时把位移清零，保证「每次打开都居中」。
 */
function watchWrap(host: HTMLElement) {
  if (watchedHosts.has(host)) return;
  watchedHosts.add(host);

  const resetWhenIdle = () => {
    if (state) return; // 正在拖的时候不要动它
    resetOffset(host);
  };

  // 开合动画会切换 ant-zoom-appear / ant-zoom-leave 等类，这是最可靠的信号
  const hostObserver = new MutationObserver(resetWhenIdle);
  hostObserver.observe(host, { attributes: true, attributeFilter: ['class'] });

  // 兜底：wrap 重新显示（display 不再是 none）也算一次新的打开
  const wrap = host.closest('.ant-modal-wrap') as HTMLElement | null;
  if (wrap) {
    const wrapObserver = new MutationObserver(() => {
      if (state) return;
      if (wrap.style.display === 'none') return;
      resetOffset(host);
    });
    wrapObserver.observe(wrap, { attributes: true, attributeFilter: ['style'] });
  }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest(IGNORES)) return;

  const handle = target.closest(HANDLE_SELECTOR);
  if (!handle) return;

  const host = handle.closest(HOST_SELECTOR) as HTMLElement | null;
  if (!host) return;
  // 已经自管拖拽的浮动窗口（工具集的对比窗）不重复接管
  if (host.classList.contains('vc-floating-dialog')) return;

  watchWrap(host);

  state = {
    host,
    startX: e.clientX,
    startY: e.clientY,
    originX: readOffset(host, '--vc-drag-x'),
    originY: readOffset(host, '--vc-drag-y'),
    rect: host.getBoundingClientRect(),
  };
  host.style.userSelect = 'none';
  e.preventDefault();
}

function onPointerMove(e: PointerEvent) {
  if (!state) return;
  const { host, startX, startY, originX, originY, rect } = state;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 视觉位置 = 当前 rect + 本次位移增量，据此限制不要整个拖出视口
  const minX = KEEP_VISIBLE - rect.left - rect.width + originX;
  const maxX = vw - KEEP_VISIBLE - rect.left + originX;
  const minY = -rect.top + originY;
  const maxY = vh - KEEP_VISIBLE - rect.top + originY;

  const x = Math.min(maxX, Math.max(minX, originX + (e.clientX - startX)));
  const y = Math.min(maxY, Math.max(minY, originY + (e.clientY - startY)));

  host.style.setProperty('--vc-drag-x', `${Math.round(x)}px`);
  host.style.setProperty('--vc-drag-y', `${Math.round(y)}px`);
}

function onPointerUp() {
  if (!state) return;
  state.host.style.userSelect = '';
  state = null;
}

/**
 * 每次弹窗重新打开都把位移清零，保证「默认屏幕居中」。
 * antd 的 Modal 会复用同一份 DOM，靠它入场时的缩放动画事件来判定「又打开了一次」。
 */
function onAnimationStart(e: AnimationEvent) {
  const el = e.target as HTMLElement | null;
  if (!el?.classList) return;
  if (el.classList.contains('ant-modal') || el.classList.contains('vc-todopanel')) {
    resetOffset(el);
  }
}

export function installWindowDrag(): () => void {
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  document.addEventListener('animationstart', onAnimationStart, true);

  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    document.removeEventListener('animationstart', onAnimationStart, true);
    state = null;
  };
}
