import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphEdge, GraphNode } from '@/api/graph';

interface MapCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: number | null;
  onSelect: (node: GraphNode) => void;
  onBackground?: () => void;
}

/**
 * 知识地图画布（确定性环形布局，不跑力导向模拟）。
 *
 * 为什么不用力导向：节点半径由文字宽度决定（30px 量级），力导向的重叠程度不可控，
 * 收敛结果跟参数强相关，实测会出现 4 对节点重叠、整体跨度太小，zoomToFit 放大后糊成一坨。
 * 这里改成"一次算准坐标 + 钉住节点（fx/fy）"：
 *   1. 按语义簇分组（degree>0 按 clusterId，每篇孤岛自成一组）
 *   2. 组内节点排在自己的环上，环半径按弦长公式保证相邻节点不重叠
 *   3. 各组圆心排在外环，外环半径按"两组包围圆不相交"求，取最紧的可行值
 * 画出来的结果是若干个清清爽爽的圆环团，线一定看得见；拖动节点也不会被弹回去。
 *
 * 视觉参照图二：标签写在圆内、按类别分色、连线细灰、无发光。
 * 力导向组件只在 view=map 时动态 import，文档视图不会把该 chunk 拉下来。
 */

/** 知识图谱常用分类色：蓝 / 青绿 / 黄 / 橙红 / 天蓝 / 紫 / 橙 / 深青 */
const PALETTE = ['#5B8FF9', '#5AD8A6', '#F6BD16', '#E8684A', '#6DC8EC', '#9270CA', '#FF9D4D', '#269A99'];

/** 圆内最多渲染的字符宽度（px），超出截断加省略号 */
const LABEL_MAX_WIDTH = 46;
const NODE_MIN_RADIUS = 14;
const NODE_MAX_RADIUS = 27;
/** 相邻节点之间保留的最小间隙 */
const NODE_GAP = 32;
/** 相邻两个组（团）之间保留的最小间隙 */
const GROUP_GAP = 30;
/**
 * 布局整体外扩系数。纯按"刚好不重叠"排，整张图的跨度会偏小，
 * zoomToFit 放大后屏幕上节点直径接近 80px，显得又大又挤。
 * 1.25 是实测折中：屏幕节点直径约 54px、字号约 10.4px、最小间隙约 53px。
 */
const GROUP_SPREAD = 1.25;

const FONT_FAMILY = '"DM Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
const NODE_FONT_SIZE = 10.5;
const NODE_FONT = `600 ${NODE_FONT_SIZE}px ${FONT_FAMILY}`;

interface ForceNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface ForceLink {
  source: number | ForceNode;
  target: number | ForceNode;
  similarity: number;
}

interface NodeVisual {
  label: string;
  radius: number;
  color: string;
  textColor: string;
}

interface Point {
  x: number;
  y: number;
}

/** 离屏上下文只用于量文字宽度，避免每次绘制都创建 canvas */
let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string): number {
  if (typeof document === 'undefined') return text.length * NODE_FONT_SIZE;
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  if (!measureCtx) return text.length * NODE_FONT_SIZE;
  measureCtx.font = NODE_FONT;
  return measureCtx.measureText(text).width;
}

/** 按像素宽度截断标题（中文一字约 10.5px，英文更窄，交给 measure 判断） */
function fitLabel(title: string): string {
  const text = (title || '未命名').trim();
  if (!text) return '未命名';
  if (measureText(text) <= LABEL_MAX_WIDTH) return text;
  let out = '';
  for (const ch of text) {
    if (measureText(out + ch) > LABEL_MAX_WIDTH) return `${out}…`;
    out += ch;
  }
  return `${out}…`;
}

/** 按底色亮度选字色，黄花 / 青底用深字，蓝紫红底用白字 */
function pickTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#2A2F3A' : '#FFFFFF';
}

function buildVisual(node: GraphNode): NodeVisual {
  const label = fitLabel(node.title);
  const textWidth = measureText(label);
  // 半径随文字宽度走：圆形刚好包住字，核心节点（degree 高）略大一点
  const radius = Math.max(
    NODE_MIN_RADIUS,
    Math.min(NODE_MAX_RADIUS, textWidth / 2 + 8 + Math.min(4, node.degree * 0.8))
  );
  const color = PALETTE[Math.abs(node.colorKey) % PALETTE.length];
  return { label, radius, color, textColor: pickTextColor(color) };
}

interface GroupLayout {
  members: GraphNode[];
  ring: number;
  bound: number;
}

/** 一个组的排布：成员均匀落在自己的环上，环半径由弦长反解，保证相邻节点不重叠 */
function measureGroup(
  members: GraphNode[],
  centers: Map<number, Point>,
  visuals: Map<number, NodeVisual>
): void {
  const radii = members.map((m) => visuals.get(m.id)?.radius ?? NODE_MIN_RADIUS);
  const maxRadius = Math.max(...radii);
  const count = members.length;
  if (count <= 1) {
    const peer = members[0];
    if (peer) centers.set(peer.id, { x: 0, y: 0 });
    return;
  }
  // 弦长需要 ≥ 2r + gap；弦长 = 2*ring*sin(π/k) → ring = need / (2*sin(π/k))
  const chordNeed = 2 * maxRadius + NODE_GAP;
  const ring = Math.max(chordNeed, chordNeed / (2 * Math.sin(Math.PI / count))) * GROUP_SPREAD;
  members.forEach((member, order) => {
    const angle = (2 * Math.PI * order) / count - Math.PI / 2;
    centers.set(member.id, { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring });
  });
}

const MapCanvas: React.FC<MapCanvasProps> = ({ nodes, edges, selectedId, onSelect, onBackground }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GraphComponent, setGraphComponent] = useState<React.ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  /** 鼠标在容器内的坐标，用于给悬停提示定位（用 ref 存，避免每次移动都重渲染） */
  const cursorRef = useRef({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverId, setHoverId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('react-force-graph-2d')
      .then((mod) => {
        if (!cancelled) setGraphComponent(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setGraphComponent(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 容器尺寸跟随布局变化（抽屉浮层、侧栏折叠、窗口缩放、地图首次进入）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const width = Math.max(wrap.clientWidth, 1);
      const height = Math.max(wrap.clientHeight, 1);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [GraphComponent]);

  /**
   * 父组件每次渲染都会重建 nodes / edges 数组（选中节点、切换筛选都会），
   * 所以 memo 依赖用内容签名：只有数据真的变了才重建节点对象与坐标。
   */
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const nodeSignature = useMemo(
    () =>
      nodes
        .map((n) => `${n.id}:${n.degree}:${n.chunkCount}:${n.colorKey}:${n.clusterId ?? 0}:${n.title}`)
        .join('|'),
    [nodes]
  );
  const edgeSignature = useMemo(
    () => edges.map((e) => `${e.source}-${e.target}:${e.similarity.toFixed(3)}`).join('|'),
    [edges]
  );

  const visuals = useMemo(() => {
    const map = new Map<number, NodeVisual>();
    for (const node of nodesRef.current) map.set(node.id, buildVisual(node));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeSignature]);

  const adjacency = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const edge of edgesRef.current) {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeSignature]);

  /**
   * 布局：分组 → 组内环 → 组外环。
   * 返回值是每个节点的最终坐标，直接钉到 fx/fy，力导向不再参与排布。
   */
  const positions = useMemo(() => {
    const source = nodesRef.current;
    const byGroup = new Map<string, GraphNode[]>();
    for (const node of source) {
      const key = node.degree > 0 ? `cluster:${node.clusterId ?? 0}` : `island:${node.id}`;
      const list = byGroup.get(key) ?? [];
      list.push(node);
      byGroup.set(key, list);
    }
    const bySize = [...byGroup.values()].sort((a, b) => b.length - a.length);

    // 先把每组在"原点坐标系"里排好，拿到组包围半径
    const groups: GroupLayout[] = bySize.map((members) => {
      const centers = new Map<number, Point>();
      measureGroup(members, centers, visuals);
      const ring = Math.max(...[...centers.values()].map((p) => Math.hypot(p.x, p.y)));
      const maxRadius = Math.max(...members.map((m) => visuals.get(m.id)?.radius ?? NODE_MIN_RADIUS));
      return { members, ring, bound: ring + maxRadius };
    });

    // 组圆心外环：任意相邻两组的包围圆不相交
    const groupCount = groups.length;
    let orbit = 0;
    if (groupCount > 1) {
      orbit =
        Math.max(
          ...groups.map((group, index) => {
            const next = groups[(index + 1) % groupCount];
            return (group.bound + next.bound + GROUP_GAP) / (2 * Math.sin(Math.PI / groupCount));
          })
        ) * GROUP_SPREAD;
    }

    const positions = new Map<number, Point>();
    groups.forEach((group, index) => {
      const groupAngle = -Math.PI / 2 + (2 * Math.PI * index) / groupCount;
      const gx = Math.cos(groupAngle) * orbit;
      const gy = Math.sin(groupAngle) * orbit;
      const centers = new Map<number, Point>();
      measureGroup(group.members, centers, visuals);
      for (const member of group.members) {
        const local = centers.get(member.id) ?? { x: 0, y: 0 };
        positions.set(member.id, { x: gx + local.x, y: gy + local.y });
      }
    });
    return positions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeSignature, visuals]);

  /**
   * 节点对象在这里创建一次并复用；坐标直接写在 fx / fy（d3 的"固定节点"），
   * 引擎不会再把它们挪走，用户拖动松手后位置也保留。
   */
  const graphData = useMemo(() => {
    const positionMap = positions;
    return {
      nodes: nodesRef.current.map((node) => {
        const point = positionMap.get(node.id);
        return {
          ...node,
          x: point?.x ?? 0,
          y: point?.y ?? 0,
          fx: point?.x ?? 0,
          fy: point?.y ?? 0,
        } as ForceNode;
      }),
      links: edgesRef.current.map((edge) => ({
        source: edge.source,
        target: edge.target,
        similarity: edge.similarity,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeSignature, edgeSignature, positions]);

  const focusId = hoverId ?? selectedId;
  const dimmed = (id: number) => {
    if (focusId == null) return false;
    if (id === focusId) return false;
    return !adjacency.get(focusId)?.has(id);
  };

  /** 悬停节点的完整信息：圆内标签会被截断，全名放到 tooltip 上 */
  const hoverNode = hoverId == null ? null : nodes.find((node) => node.id === hoverId) ?? null;

  /** 鼠标移动只改 DOM 的 transform，不触发 React 重渲染（画布重绘代价高） */
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    cursorRef.current = { x, y };
    const tip = tooltipRef.current;
    if (!tip) return;
    const tipWidth = tip.offsetWidth || 220;
    const tipHeight = tip.offsetHeight || 48;
    const flipX = x + 16 + tipWidth > rect.width;
    const flipY = y + 18 + tipHeight > rect.height;
    tip.style.transform = [
      `translate(${x}px, ${y}px)`,
      `translate(${flipX ? '-100%' : '0px'}, ${flipY ? '-100%' : '0px'})`,
      `translate(${flipX ? -14 : 16}px, ${flipY ? -14 : 18}px)`,
    ].join(' ');
  };

  // 引擎不参与排布：一挂载就停，只为触发一次 onEngineStop 好让画面居中
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || !GraphComponent) return;
    fg.d3Force('charge')?.strength(0);
    const link = fg.d3Force('link');
    if (link) link.strength?.(0);
    fg.d3Force('center')?.strength(0);
    fg.d3ReheatSimulation?.();
  }, [graphData, GraphComponent]);

  const handleEngineStop = () => {
    graphRef.current?.zoomToFit?.(360, 44);
  };

  // 尺寸变化（首帧 / 侧栏折叠 / 窗口缩放）和数据变化后重新居中一次
  useEffect(() => {
    if (!GraphComponent || size.width < 2 || size.height < 2) return;
    const timer = window.setTimeout(() => {
      graphRef.current?.zoomToFit?.(360, 44);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [GraphComponent, size.width, size.height, nodeSignature]);

  if (!GraphComponent) {
    return (
      <div className="vc-kmap__canvas-loading">
        <span className="vc-kmap__line" />
        <span className="vc-kmap__line" />
        <span className="vc-kmap__line" />
        <span className="vc-kmap__hint">正在加载渲染组件…</span>
      </div>
    );
  }

  const showAllLabels = nodes.length <= 80;

  return (
    <div className="vc-kmap__canvas" ref={wrapRef} onMouseMove={handleMouseMove}>
      {size.width > 1 && size.height > 1 && (
        <GraphComponent
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          cooldownTicks={0}
          warmupTicks={0}
          enablePointerInteraction
          onEngineStop={handleEngineStop}
          linkColor={(link: ForceLink) => `rgba(150, 155, 172, ${(0.3 + 0.28 * link.similarity).toFixed(3)})`}
          linkWidth={1}
          linkDirectionalParticles={0}
          onNodeHover={(node: ForceNode | null) => setHoverId(node ? node.id : null)}
          onNodeClick={(node: ForceNode) => onSelect(node)}
          onNodeDragEnd={(node: ForceNode) => {
            // 松手后把节点钉在新位置，避免任何残余力把它拉回去
            node.fx = node.x;
            node.fy = node.y;
          }}
          onBackgroundClick={() => onBackground?.()}
          nodeCanvasObject={(node: ForceNode, ctx: CanvasRenderingContext2D, scale: number) => {
            const visual = visuals.get(node.id);
            if (!visual) return;
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const isFocus = node.id === focusId;
            const alpha = dimmed(node.id) ? 0.2 : 1;

            ctx.globalAlpha = alpha;

            // 焦点节点套一圈浅色外环，代替以前的发光
            if (isFocus) {
              ctx.beginPath();
              ctx.arc(x, y, visual.radius + 3.5, 0, 2 * Math.PI);
              ctx.strokeStyle = `${visual.color}66`;
              ctx.lineWidth = 3;
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(x, y, visual.radius, 0, 2 * Math.PI);
            ctx.fillStyle = visual.color;
            ctx.fill();
            if (node.id === selectedId) {
              ctx.lineWidth = 2;
              ctx.strokeStyle = 'rgba(255,255,255,0.92)';
              ctx.stroke();
            }

            // 标签画在圆内：canvas 已带全局 zoom 变换，不再二次缩放
            if (showAllLabels || isFocus || scale > 1.05) {
              ctx.font = NODE_FONT;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = visual.textColor;
              ctx.fillText(visual.label, x, y);
            }
            ctx.globalAlpha = 1;
          }}
          nodePointerAreaPaint={(node: ForceNode, color: string, ctx: CanvasRenderingContext2D) => {
            const radius = (visuals.get(node.id)?.radius ?? NODE_MIN_RADIUS) + 2;
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      )}

      {hoverNode && (
        <div
          className="vc-kmap__tooltip"
          ref={tooltipRef}
          style={{ transform: `translate(${cursorRef.current.x + 16}px, ${cursorRef.current.y + 18}px)` }}
        >
          <strong className="vc-kmap__tooltip-title">{hoverNode.title}</strong>
          <span className="vc-kmap__tooltip-meta">
            {hoverNode.chunkCount > 0 ? `${hoverNode.chunkCount} 个片段` : '尚未向量化'} · {hoverNode.degree} 条关联
            {hoverNode.clusterId ? ` · 簇 ${hoverNode.clusterId}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
