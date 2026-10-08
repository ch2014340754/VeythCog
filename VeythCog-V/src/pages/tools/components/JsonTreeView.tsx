import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import chevronRightIcon from '@iconify-icons/lucide/chevron-right';
import chevronDownIcon from '@iconify-icons/lucide/chevron-down';
import { Icon } from '@iconify/react';

const INDENT = 20;

/** 基础值渲染（字符串/数字/布尔/null），带语法着色 */
function renderPrimitive(value: any, colors: any): React.ReactNode {
  if (value === null) return <span style={{ color: colors.error }}>null</span>;
  if (typeof value === 'boolean') return <span style={{ color: colors.error }}>{String(value)}</span>;
  if (typeof value === 'number') return <span style={{ color: colors.warning }}>{String(value)}</span>;
  // string：用 JSON.stringify 保证转义一致
  return <span style={{ color: colors.success }}>{JSON.stringify(value)}</span>;
}

/** 收缩态下容器节点的紧凑预览（只返回括号内部内容，不含外层括号） */
function renderInnerPreview(value: any, colors: any): React.ReactNode {
  if (Array.isArray(value)) {
    return value.length === 0 ? null : (
      <span>
        {value.slice(0, 2).map((v, i) => (
          <span key={i}>
            {i > 0 ? ', ' : ''}
            {v !== null && typeof v === 'object'
              ? Array.isArray(v) ? '[…]' : '{…}'
              : renderPrimitive(v, colors)}
          </span>
        ))}
        {value.length > 2 ? ', …' : ''}
      </span>
    );
  }
  const keys = Object.keys(value);
  return keys.length === 0 ? null : (
    <span>
      {keys.slice(0, 2).map((k, i) => (
        <span key={i}>
          {i > 0 ? ', ' : ''}
          <span style={{ color: colors.primary }}>{JSON.stringify(k)}</span>
          <span style={{ color: colors.textSecondary }}>: </span>
          {value[k] !== null && typeof value[k] === 'object'
            ? Array.isArray(value[k]) ? '[…]' : '{…}'
            : renderPrimitive(value[k], colors)}
        </span>
      ))}
      {keys.length > 2 ? ', …' : ''}
    </span>
  );
}

/** 收集所有容器节点（对象/数组）的路径，用于"折叠全部" */
function collectContainerPaths(value: any, prefix: string, out: string[]): void {
  if (value === null || typeof value !== 'object') return;
  out.push(prefix);
  const isArray = Array.isArray(value);
  const keys = isArray ? (value as any[]).map((_, i) => i) : Object.keys(value);
  keys.forEach((k, i) => {
    const childPath = prefix ? `${prefix}/${JSON.stringify(String(k))}` : JSON.stringify(String(k));
    collectContainerPaths(isArray ? value[i] : value[k], childPath, out);
  });
}

interface NodeProps {
  name: string | number | null; // null 表示根节点
  value: any;
  depth: number;
  path: string;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
  colors: any;
}

const JsonNode: React.FC<NodeProps> = ({ name, value, depth, path, collapsedPaths, onToggle, colors }) => {
  const collapsed = collapsedPaths.has(path);
  const isContainer = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  // 名称部分（叶子/容器统一生成），根节点无名称
  const namePart =
    name === null ? null : (
      <span style={{ color: colors.textSecondary }}>
        <span style={{ color: colors.primary }}>{JSON.stringify(String(name))}</span>
        <span>: </span>
      </span>
    );

  if (!isContainer) {
    return (
      <div style={{ paddingLeft: depth * INDENT, lineHeight: 1.7 }}>
        {namePart}
        {renderPrimitive(value, colors)}
      </div>
    );
  }

  const entries = isArray
    ? (value as any[]).map((v, i) => ({ key: i, v }))
    : Object.entries(value).map(([k, v]) => ({ key: k, v }));

  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  const toggle = (
    <button
      onClick={() => onToggle(path)}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        color: colors.textSecondary,
      }}
      title={collapsed ? '展开' : '收缩'}
      aria-expanded={!collapsed}
    >
      <Icon icon={collapsed ? chevronRightIcon : chevronDownIcon} width={14} height={14} />
    </button>
  );

  if (collapsed) {
    // 收缩态：单行显示 toggle + 括号 + 紧凑预览
    return (
      <div style={{ paddingLeft: depth * INDENT, lineHeight: 1.7 }}>
        {toggle}{' '}
        <span>
          {namePart}
          <span>{openBracket}</span>
          <span>{renderInnerPreview(value, colors)}</span>
          <span>{closeBracket}</span>
        </span>
      </div>
    );
  }

  if (entries.length === 0) {
    // 空对象 / 空数组：单行 { } 或 [ ]
    return (
      <div style={{ paddingLeft: depth * INDENT, lineHeight: 1.7 }}>
        {toggle}{' '}
        <span>
          {namePart}
          <span>{openBracket} {closeBracket}</span>
        </span>
      </div>
    );
  }

  // 展开态：首行 toggle + 名称 + 开括号，子节点缩进，末行闭括号
  return (
    <div style={{ lineHeight: 1.7 }}>
      <div style={{ paddingLeft: depth * INDENT }}>
        {toggle}{' '}
        <span>
          {namePart}
          <span>{openBracket}</span>
        </span>
      </div>
      {entries.map(({ key, v }) => {
        const childPath = `${path}/${JSON.stringify(String(key))}`;
        return (
          <JsonNode
            key={key}
            name={key}
            value={v}
            depth={depth + 1}
            path={childPath}
            collapsedPaths={collapsedPaths}
            onToggle={onToggle}
            colors={colors}
          />
        );
      })}
      <div style={{ paddingLeft: depth * INDENT }}>
        <span>{closeBracket}</span>
      </div>
    </div>
  );
};

interface Props {
  code: string;
  style?: React.CSSProperties;
}

export interface JsonTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

/** 可交互 JSON 树：支持逐节点以及全部展开 / 折叠（通过 ref 暴露） */
const JsonTreeView = forwardRef<JsonTreeHandle, Props>(({ code, style }, ref) => {
  const { colors } = useTheme();

  // 解析数据（code 为空或解析失败时为 undefined）
  const data = useMemo(() => {
    if (!code) return undefined;
    try {
      return JSON.parse(code);
    } catch {
      return undefined;
    }
  }, [code]);

  // 所有容器节点路径，用于"折叠全部"
  const allPaths = useMemo(() => {
    const out: string[] = [];
    if (data !== undefined) collectContainerPaths(data, '', out);
    return out;
  }, [data]);

  // 收缩状态统一上提到此组件管理
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  // 内容变化时重置为全部展开
  useEffect(() => {
    setCollapsedPaths(new Set());
  }, [code]);

  const toggle = (path: string) =>
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const expandAll = () => setCollapsedPaths(new Set());
  const collapseAll = () => setCollapsedPaths(new Set(allPaths));

  useImperativeHandle(ref, () => ({ expandAll, collapseAll }));

  const content =
    data === undefined ? (
      <span style={{ color: colors.error }}> 无效JSON</span>
    ) : (
      <JsonNode
        name={null}
        value={data}
        depth={0}
        path=""
        collapsedPaths={collapsedPaths}
        onToggle={toggle}
        colors={colors}
      />
    );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: 12,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        ...style,
      }}
    >
      {content}
    </div>
  );
});

export default JsonTreeView;
