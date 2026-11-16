import {
  createFolder,
  deleteDoc,
  deleteFolder,
  getFolderStats,
  moveDoc,
  moveFolder,
  renameDoc,
  renameFolder,
} from '@/api/knowledge';
import type { KnowledgeDocNode, KnowledgeTree } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';
import fileTextIcon from '@iconify-icons/lucide/file-text';
import foldVerticalIcon from '@iconify-icons/lucide/fold-vertical';
import folderIcon from '@iconify-icons/lucide/folder';
import folderOpenIcon from '@iconify-icons/lucide/folder-open';
import folderPlusIcon from '@iconify-icons/lucide/folder-plus';
import pencilIcon from '@iconify-icons/lucide/pencil';
import plusIcon from '@iconify-icons/lucide/plus';
import trashIcon from '@iconify-icons/lucide/trash-2';
import unfoldVerticalIcon from '@iconify-icons/lucide/unfold-vertical';
import zapIcon from '@iconify-icons/lucide/zap';
import { Icon } from '@iconify/react';
import { Input, message, Modal, Select, Spin, Tree } from 'antd';
import type { DataNode, TreeProps } from 'antd/es/tree';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import TreeContextMenu, { type TreeMenuItem } from './TreeContextMenu';
import './tree.css';

/** 树节点：antd DataNode + 业务字段 */
interface TreeItem extends DataNode {
  /** root = 虚拟根「全部文档」，仅用于承接拖回根级 */
  itemKind: 'root' | 'folder' | 'doc';
  itemId?: number;
  /** 父目录 id；null = 根级（doc 的 parentId 即所属目录） */
  parentId: number | null;
  title: string;
  doc?: KnowledgeDocNode;
  children?: TreeItem[];
  /** 子树内文档总数 */
  docCount: number;
}

export interface DocTreeProps {
  tree: KnowledgeTree | null;
  loading: boolean;
  keyword: string;
  activeDocId: number | null;
  /** 当前落点目录（文件夹行的「正在查看」标记） */
  activeFolderId: number | null;
  onOpenDoc: (id: number) => void;
  onCreateDoc: (folderId: number | null) => void;
  /** 静默刷新（不闪加载态） */
  onRefresh: (opts?: { silent?: boolean }) => void;
  onDocsRemoved: (docIds: number[]) => void;
  onDocRenamed: (docId: number, title: string) => void;
  /** 当前选中的目录（新建文档 / 导入的默认落点） */
  onActiveFolderChange: (folderId: number | null) => void;
  /** 导出选集变化（Ctrl / ⌘ 攒出来的文档），供导出面板显示「已选 N 篇」 */
  onSelectionChange?: (docIds: number[]) => void;
}

export interface DocTreeHandle {
  /** 在指定目录下新建子目录（不传 = 根级），供侧栏头部按钮调用 */
  openCreateFolder: (parentId?: number | null) => void;
  /** 当前选中的文档 id（普通点击 = 单篇，Ctrl / ⌘ 点击 = 多选集合），供「批量导出选中」使用 */
  getSelectedDocIds: () => number[];
}

const ROOT_KEY = 'root';
const MAX_NAME = 100;
const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

/* ---------------------------- 纯函数：建树 / 增删查 ---------------------------- */

function sortTree(node: TreeItem): void {
  if (!node.children?.length) return;
  node.children.sort((a, b) => {
    if (a.itemKind !== b.itemKind) return a.itemKind === 'folder' ? -1 : 1;
    if (a.itemKind === 'folder') return COLLATOR.compare(a.title, b.title);
    // 文档按更新时间倒序，最近写的在最上面
    return (b.doc?.updatedAt ?? 0) - (a.doc?.updatedAt ?? 0);
  });
  node.children.forEach(sortTree);
}

function recount(node: TreeItem): number {
  let count = node.itemKind === 'doc' ? 1 : 0;
  node.children?.forEach((child) => {
    count += recount(child);
  });
  node.docCount = count;
  return count;
}

/** 把接口的扁平 folders + docs 组装成一棵以「全部文档」为根的树 */
export function buildTree(data: KnowledgeTree): TreeItem {
  const folderMap = new Map<number, TreeItem>();
  data.folders.forEach((folder) => {
    folderMap.set(folder.id, {
      key: `f:${folder.id}`,
      itemKind: 'folder',
      itemId: folder.id,
      parentId: folder.parentId ?? null,
      title: folder.name,
      children: [],
      docCount: 0,
    });
  });

  const root: TreeItem = {
    key: ROOT_KEY,
    itemKind: 'root',
    parentId: null,
    title: '全部文档',
    children: [],
    docCount: 0,
  };

  // 父目录缺失（被并发删除等异常）时兜底挂到根，保证不丢节点
  folderMap.forEach((folder) => {
    const parent = folder.parentId != null ? folderMap.get(folder.parentId) : undefined;
    (parent ?? root).children!.push(folder);
  });

  data.docs.forEach((doc) => {
    const item: TreeItem = {
      key: `d:${doc.id}`,
      itemKind: 'doc',
      itemId: doc.id,
      parentId: doc.folderId ?? null,
      title: doc.title,
      doc,
      docCount: 1,
    };
    const parent = doc.folderId != null ? folderMap.get(doc.folderId) : undefined;
    (parent ?? root).children!.push(item);
  });

  sortTree(root);
  recount(root);
  return root;
}

function collectFolderKeys(node: TreeItem): string[] {
  const keys: string[] = [];
  const walk = (n: TreeItem) => {
    if (n.itemKind === 'doc') return;
    keys.push(String(n.key));
    n.children?.forEach(walk);
  };
  walk(node);
  return keys;
}

function findItem(node: TreeItem, key: string): TreeItem | undefined {
  if (String(node.key) === key) return node;
  for (const child of node.children ?? []) {
    const hit = findItem(child, key);
    if (hit) return hit;
  }
  return undefined;
}

function containsKey(node: TreeItem, key: string): boolean {
  if (String(node.key) === key) return true;
  return (node.children ?? []).some((child) => containsKey(child, key));
}

/** 从树里摘掉一个节点（连同其子树）并返回它 */
function detach(node: TreeItem, key: string): TreeItem | null {
  const children = node.children ?? [];
  for (let i = 0; i < children.length; i += 1) {
    if (String(children[i].key) === key) {
      const [removed] = children.splice(i, 1);
      return removed;
    }
    const hit = detach(children[i], key);
    if (hit) return hit;
  }
  return null;
}

/** 收集子树内所有文档 id（删除前用来判断当前打开的文档是否被删掉） */
function collectDocIds(node: TreeItem): number[] {
  const ids: number[] = [];
  const walk = (n: TreeItem) => {
    if (n.itemKind === 'doc' && n.itemId != null) ids.push(n.itemId);
    n.children?.forEach(walk);
  };
  walk(node);
  return ids;
}

function cloneTree(node: TreeItem): TreeItem {
  return JSON.parse(JSON.stringify(node)) as TreeItem;
}

function highlight(text: string, keyword: string): React.ReactNode {
  const kw = keyword.trim();
  if (!kw) return text;
  const idx = text.toLowerCase().indexOf(kw.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="vc-tree__hit">{text.slice(idx, idx + kw.length)}</span>
      {text.slice(idx + kw.length)}
    </>
  );
}

/* --------------------------------- 组件 --------------------------------- */

const DocTree = forwardRef<DocTreeHandle, DocTreeProps>(function DocTree(props, ref) {
  const {
    tree,
    loading,
    keyword,
    activeDocId,
    activeFolderId,
    onOpenDoc,
    onCreateDoc,
    onRefresh,
    onDocsRemoved,
    onDocRenamed,
    onActiveFolderChange,
    onSelectionChange,
  } = props;

  const [root, setRoot] = useState<TreeItem | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string } | null>(null);

  const initedRef = useRef(false);
  const knownKeysRef = useRef<Set<string>>(new Set());
  const expandedKeysRef = useRef<React.Key[]>([]);
  const searchSnapshotRef = useRef<React.Key[] | null>(null);
  const rootRef = useRef<TreeItem | null>(null);

  // 重命名
  const [renameTarget, setRenameTarget] = useState<TreeItem | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  // 新建目录
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderParentId, setFolderParentId] = useState<number | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  // 移动到目录
  const [moveTarget, setMoveTarget] = useState<TreeItem | null>(null);
  const [moveTo, setMoveTo] = useState<number>(0);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    expandedKeysRef.current = expandedKeys;
  }, [expandedKeys]);

  useEffect(() => {
    rootRef.current = root;
  }, [root]);

  /* 数据变化 → 重建树；首次全展开，之后保留用户折叠过的、新增目录自动展开 */
  useEffect(() => {
    if (!tree) return;
    const next = buildTree(tree);
    setRoot(next);
    const keys = collectFolderKeys(next);
    if (keyword.trim()) {
      // 搜索态：结果集较小，强制全展开，免得命中项藏在折叠目录里
      knownKeysRef.current = new Set(keys);
      setExpandedKeys(keys);
      return;
    }
    setExpandedKeys((prev) => {
      if (!initedRef.current) {
        initedRef.current = true;
        knownKeysRef.current = new Set(keys);
        return keys;
      }
      const prevSet = new Set(prev);
      const result = keys.filter(
        (k) => k === ROOT_KEY || prevSet.has(k) || !knownKeysRef.current.has(k)
      );
      knownKeysRef.current = new Set(keys);
      return result;
    });
  }, [tree, keyword]);

  /* 搜索进入 / 退出：记录、恢复展开态 */
  useEffect(() => {
    if (keyword.trim()) {
      if (!searchSnapshotRef.current) searchSnapshotRef.current = expandedKeysRef.current;
      return;
    }
    if (searchSnapshotRef.current) {
      setExpandedKeys(searchSnapshotRef.current);
      searchSnapshotRef.current = null;
    }
  }, [keyword]);

  /* 选中集只服务于「批量导出」，跟「当前打开哪篇」无关：
     打开文档靠 vc-tree-node--current 那条竖条区分，不再往选中集里塞东西。
     这样 Ctrl 攒好一批后随手点开其中一篇复习，集合不会被悄悄改名成一篇。 */
  const selectedDocIds = useMemo(
    () =>
      selectedKeys
        .map((k) => String(k))
        .filter((k) => k.startsWith('d:'))
        .map((k) => Number(k.slice(2)))
        .filter((id) => Number.isFinite(id)),
    [selectedKeys]
  );

  useEffect(() => {
    onSelectionChange?.(selectedDocIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocIds]);

  /** 给树节点打「正在查看」标记（当前文档 / 当前落点目录） */
  const decoratedTree = useMemo(() => {
    if (!root) return [] as DataNode[];
    const docKey = activeDocId != null ? `d:${activeDocId}` : null;
    const folderKey = activeFolderId != null ? `f:${activeFolderId}` : null;
    const walk = (n: TreeItem): TreeItem => {
      const key = String(n.key);
      const current = n.itemKind !== 'root' && (key === docKey || key === folderKey);
      return {
        ...n,
        className: current ? 'vc-tree-node--current' : undefined,
        children: n.children?.map(walk),
      };
    };
    return [walk(root)] as DataNode[];
  }, [root, activeDocId, activeFolderId]);

  const itemMap = useMemo(() => {
    const map = new Map<string, TreeItem>();
    const walk = (n: TreeItem) => {
      map.set(String(n.key), n);
      n.children?.forEach(walk);
    };
    if (root) walk(root);
    return map;
  }, [root]);

  const expandedSet = useMemo(() => new Set(expandedKeys.map(String)), [expandedKeys]);

  /** 所有文件夹 key（不含虚拟根「全部文档」），供「展开/收起全部」用 */
  const folderKeys = useMemo(
    () => (root ? collectFolderKeys(root).filter((k) => k !== ROOT_KEY) : []),
    [root]
  );

  /** 是否已经全部展开（搜索态由树强制全展开，按钮只读） */
  const allExpanded =
    folderKeys.length > 0 && folderKeys.every((k) => expandedSet.has(k));

  const toggleAllFolders = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (keyword.trim() || folderKeys.length === 0) return;
    setExpandedKeys(allExpanded ? [ROOT_KEY] : [ROOT_KEY, ...folderKeys]);
  };

  /** 移动到… 的下拉选项：带完整路径，便于区分同名目录 */
  const folderOptions = useMemo(() => {
    const options: { label: string; value: number }[] = [{ label: '根目录（全部文档）', value: 0 }];
    const walk = (n: TreeItem, path: string[]) => {
      n.children?.forEach((child) => {
        if (child.itemKind !== 'folder' || child.itemId == null) return;
        const nextPath = [...path, child.title];
        options.push({ label: nextPath.join(' / '), value: child.itemId });
        walk(child, nextPath);
      });
    };
    if (root) walk(root, []);
    return options;
  }, [root]);

  const notifyError = useCallback((e: unknown, fallback: string) => {
    message.error(e instanceof Error ? e.message : fallback);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openCreateFolder: (parentId: number | null = null) => {
        setFolderParentId(parentId);
        setFolderName('');
        setFolderOpen(true);
      },
      getSelectedDocIds: () => selectedDocIds,
    }),
    [selectedDocIds]
  );

  /* ------------------------------ 拖拽 ------------------------------ */

  const resolveParentKey = (item: TreeItem): string =>
    item.parentId != null ? `f:${item.parentId}` : ROOT_KEY;

  const handleAllowDrop: (p: {
    dragNode: DataNode;
    dropNode: DataNode;
    dropPosition: number;
  }) => boolean = ({ dragNode, dropNode, dropPosition }) => {
    const drag = itemMap.get(String(dragNode.key));
    const drop = itemMap.get(String(dropNode.key));
    if (!drag || !drop || drag.itemKind === 'root') return false;
    if (drop.itemKind === 'root') return true;
    const inside = dropPosition === 0;
    if (drag.itemKind === 'doc') {
      // 文档不能落进文档内部
      return !(drop.itemKind === 'doc' && inside);
    }
    // 目录不能落进自己或自己的后代的任意位置（环）
    if (containsKey(drag, String(drop.key))) return false;
    return !(drop.itemKind === 'doc' && inside);
  };

  const applyLocalMove = (dragKey: string, parentKey: string): TreeItem | null => {
    const current = rootRef.current;
    if (!current) return null;
    const clone = cloneTree(current);
    const detached = detach(clone, dragKey);
    if (!detached) return null;
    const parent = findItem(clone, parentKey);
    if (!parent || parent.itemKind === 'doc') return null;
    (parent.children ??= []).push(detached);
    detached.parentId = parent.itemKind === 'root' ? null : (parent.itemId ?? null);
    sortTree(clone);
    recount(clone);
    return clone;
  };

  const handleDrop: TreeProps['onDrop'] = (info) => {
    const drag = itemMap.get(String(info.dragNode.key));
    const drop = itemMap.get(String(info.node.key));
    if (!drag || !drop) return;
    // antd 在部分路径下不返回 dropToGap，这里用 dropPosition 兜底
    const dropToGap = (info as { dropToGap?: boolean }).dropToGap ?? info.dropPosition !== 0;
    const inside = !dropToGap;

    let parentKey: string;
    if (drop.itemKind === 'root') parentKey = ROOT_KEY;
    else if (drop.itemKind === 'folder') parentKey = inside ? String(drop.key) : resolveParentKey(drop);
    else parentKey = resolveParentKey(drop); // 文档只承接「落到它旁边」

    if (parentKey === resolveParentKey(drag)) return; // 同一个父级，等于没动

    const targetFolderId = parentKey === ROOT_KEY ? null : itemMap.get(parentKey)?.itemId ?? null;
    const snapshot = rootRef.current;
    const optimistic = applyLocalMove(String(drag.key), parentKey);
    if (!optimistic) return;
    setRoot(optimistic);
    if (parentKey !== ROOT_KEY) {
      setExpandedKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
    }

    const run = async () => {
      if (drag.itemKind === 'folder') await moveFolder(drag.itemId!, targetFolderId);
      else await moveDoc(drag.itemId!, targetFolderId);
      onRefresh({ silent: true });
    };
    void run().catch((e) => {
      setRoot(snapshot);
      notifyError(e, '移动失败');
      onRefresh({ silent: true });
    });
  };

  /* --------------------------- 重命名 / 新建 / 删除 --------------------------- */

  const openRename = (target: TreeItem) => {
    setRenameTarget(target);
    setRenameValue(target.title);
    setRenameOpen(true);
  };

  const validateName = (name: string): string | null => {
    if (!name) return '名称不能为空';
    if (name.length > MAX_NAME) return `名称最多 ${MAX_NAME} 个字符`;
    if (name.includes('/') || name.includes('\\')) return '名称不能包含斜杠';
    return null;
  };

  const submitRename = async () => {
    const target = renameTarget;
    if (!target) return;
    const name = renameValue.trim();
    const err = validateName(name);
    if (err) {
      message.error(err);
      return;
    }
    setRenameOpen(false);
    if (name === target.title) return;

    const snapshot = rootRef.current;
    const clone = cloneTree(rootRef.current!);
    const node = findItem(clone, String(target.key));
    if (node) {
      node.title = name;
      if (node.doc) node.doc = { ...node.doc, title: name };
      sortTree(clone);
    }
    setRoot(clone);

    setRenaming(true);
    try {
      if (target.itemKind === 'folder') {
        await renameFolder(target.itemId!, name);
      } else {
        await renameDoc(target.itemId!, name);
        onDocRenamed(target.itemId!, name);
      }
      message.success('已重命名');
      onRefresh({ silent: true });
    } catch (e) {
      setRoot(snapshot);
      notifyError(e, '重命名失败');
      onRefresh({ silent: true });
    } finally {
      setRenaming(false);
      setRenameTarget(null);
    }
  };

  const submitCreateFolder = async () => {
    const name = folderName.trim();
    const err = validateName(name);
    if (err) {
      message.error(err);
      return;
    }
    setCreatingFolder(true);
    try {
      await createFolder(folderParentId, name);
      message.success('已创建目录');
      setFolderOpen(false);
      setFolderName('');
      if (folderParentId != null) {
        const key = `f:${folderParentId}`;
        setExpandedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      }
      onRefresh({ silent: true });
    } catch (e) {
      notifyError(e, '创建目录失败');
    } finally {
      setCreatingFolder(false);
    }
  };

  const performDelete = async (target: TreeItem) => {
    const snapshot = rootRef.current;
    const docIds = collectDocIds(target);
    const clone = cloneTree(rootRef.current!);
    detach(clone, String(target.key));
    recount(clone);
    setRoot(clone);

    try {
      if (target.itemKind === 'folder') await deleteFolder(target.itemId!, true);
      else await deleteDoc(target.itemId!);
      message.success(target.itemKind === 'folder' ? '已删除目录' : '已删除文档');
      onDocsRemoved(docIds);
      onRefresh({ silent: true });
    } catch (e) {
      setRoot(snapshot);
      notifyError(e, '删除失败');
      onRefresh({ silent: true });
    }
  };

  /** 目录删除：先查影响范围，非空目录弹二次确认（默认级联删） */
  const requestDeleteFolder = async (target: TreeItem) => {
    try {
      const stats = await getFolderStats(target.itemId!);
      if (stats.docCount === 0 && stats.folderCount === 0) {
        void performDelete(target);
        return;
      }
      Modal.confirm({
        title: `删除目录「${target.title}」？`,
        content: `将一并删除 ${stats.folderCount} 个子目录、${stats.docCount} 篇文档（含已生成的向量），此操作不可撤销。`,
        okText: '删除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => performDelete(target),
      });
    } catch (e) {
      notifyError(e, '读取目录信息失败');
    }
  };

  const submitMove = async () => {
    const target = moveTarget;
    if (!target) return;
    const folderValue = moveTo === 0 ? null : moveTo;
    if (folderValue === (target.doc?.folderId ?? null)) {
      setMoveTarget(null);
      return;
    }
    setMoving(true);
    try {
      await moveDoc(target.itemId!, folderValue);
      message.success('已移动');
      setMoveTarget(null);
      onRefresh({ silent: true });
    } catch (e) {
      notifyError(e, '移动失败');
    } finally {
      setMoving(false);
    }
  };

  /* ------------------------------ 右键菜单 ------------------------------ */

  const openMenu = (e: React.MouseEvent, node: DataNode) => {
    e.preventDefault();
    e.stopPropagation();
    const item = itemMap.get(String(node.key));
    if (!item) return;
    // 右键不动导出选集：Ctrl 攒的一批要能原样留着
    if (item.itemKind === 'doc') {
      onOpenDoc(item.itemId!);
    } else {
      onActiveFolderChange(item.itemKind === 'folder' ? item.itemId ?? null : null);
    }
    setMenu({ x: e.clientX, y: e.clientY, key: String(item.key) });
  };

  const menuItems: TreeMenuItem[] = useMemo(() => {
    if (!menu) return [];
    const item = itemMap.get(menu.key);
    if (!item) return [];
    const items: TreeMenuItem[] = [];

    if (item.itemKind === 'root') {
      items.push({
        key: 'new-folder',
        label: '新建文件夹',
        icon: <Icon icon={folderPlusIcon} width={13} />,
        onClick: () => {
          setFolderParentId(null);
          setFolderName('');
          setFolderOpen(true);
        },
      });
      items.push({
        key: 'new-doc',
        label: '新建文档',
        icon: <Icon icon={plusIcon} width={13} />,
        onClick: () => onCreateDoc(null),
      });
      return items;
    }

    if (item.itemKind === 'folder') {
      items.push({
        key: 'new-sub-folder',
        label: '新建子文件夹',
        icon: <Icon icon={folderPlusIcon} width={13} />,
        onClick: () => {
          setFolderParentId(item.itemId ?? null);
          setFolderName('');
          setFolderOpen(true);
        },
      });
      items.push({
        key: 'new-doc',
        label: '新建文档',
        icon: <Icon icon={plusIcon} width={13} />,
        onClick: () => onCreateDoc(item.itemId ?? null),
      });
    }

    items.push({
      key: 'rename',
      label: '重命名',
      icon: <Icon icon={pencilIcon} width={13} />,
      onClick: () => openRename(item),
    });

    if (item.itemKind === 'doc') {
      items.push({
        key: 'move',
        label: '移动到…',
        icon: <Icon icon={folderIcon} width={13} />,
        onClick: () => {
          setMoveTarget(item);
          setMoveTo(item.doc?.folderId ?? 0);
        },
      });
    }

    items.push({
      key: 'delete',
      label: '删除',
      danger: true,
      icon: <Icon icon={trashIcon} width={13} />,
      onClick: () => {
        if (item.itemKind === 'folder') void requestDeleteFolder(item);
        else void performDelete(item);
      },
    });

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, itemMap, onCreateDoc]);

  /* ------------------------------ 渲染 ------------------------------ */

  const renderTitle = (node: TreeItem): React.ReactNode => {
    const highlighted = highlight(node.title, keyword);
    if (node.itemKind === 'root') {
      return (
        <span className="vc-tree-row">
          <Icon icon={folderIcon} width={14} className="vc-tree-row__folder vc-tree-row__folder--root" />
          <span className="vc-tree-row__title">{highlighted}</span>
          {folderKeys.length > 0 && (
            <button
              type="button"
              className="vc-tree-row__toggle"
              title={allExpanded ? '收起全部' : '展开全部'}
              disabled={keyword.trim() ? true : false}
              onClick={toggleAllFolders}
            >
              <Icon icon={allExpanded ? foldVerticalIcon : unfoldVerticalIcon} width={13} />
            </button>
          )}
          <span className="vc-tree-row__badge">{node.docCount}</span>
        </span>
      );
    }
    if (node.itemKind === 'folder') {
      const expanded = expandedSet.has(String(node.key));
      return (
        <span className="vc-tree-row">
          <Icon
            icon={expanded ? folderOpenIcon : folderIcon}
            width={14}
            className="vc-tree-row__folder"
          />
          <span className="vc-tree-row__title">{highlighted}</span>
          {node.docCount > 0 && <span className="vc-tree-row__badge">{node.docCount}</span>}
        </span>
      );
    }
    const doc = node.doc;
    return (
      <span className="vc-tree-row">
        <Icon icon={fileTextIcon} width={14} className="vc-tree-row__file" />
        <span className="vc-tree-row__title">{highlighted}</span>
        {doc?.isVectorized && (
          <span className="vc-tree-row__zap" title="已向量化">
            <Icon icon={zapIcon} width={11} />
          </span>
        )}
        {doc?.updatedAt ? (
          <span className="vc-tree-row__time">{formatRelativeTime(doc.updatedAt)}</span>
        ) : null}
      </span>
    );
  };

  const empty = !loading && root != null && root.docCount === 0;

  return (
    <div className="vc-knowledge-tree">
      {loading ? (
        <div className="vc-knowledge-list__loading">
          <Spin />
        </div>
      ) : empty ? (
        <div className="vc-knowledge-list__empty">
          {keyword.trim() ? '没有匹配的文档' : '暂无文档，右键空白处或点「新建」开始'}
        </div>
      ) : (
        <Tree
          blockNode
          virtual={false}
          selectable
          multiple
          treeData={decoratedTree}
          titleRender={(node) => renderTitle(node as unknown as TreeItem)}
          selectedKeys={selectedKeys}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={(keys, info) => {
            const key = String(info.node.key);
            const item = itemMap.get(key);
            const native = info.nativeEvent as MouseEvent | KeyboardEvent | undefined;
            const additive = Boolean(native && (native.metaKey || native.ctrlKey));
            if (additive && item?.itemKind === 'doc') {
              // Ctrl / ⌘：只动「导出选集」，不切文档——攒批时不该被迫跳转
              setSelectedKeys(keys.map(String));
              return;
            }
            // 普通点击：清空导出选集，只切换「正在查看」
            setSelectedKeys([]);
            if (!item) return;
            if (item.itemKind === 'doc') onOpenDoc(item.itemId!);
            else onActiveFolderChange(item.itemKind === 'folder' ? item.itemId ?? null : null);
          }}
          onRightClick={({ event, node }) => openMenu(event, node)}
          draggable={keyword.trim() ? false : { icon: false }}
          {...({ allowDrop: handleAllowDrop } as TreeProps)}
          onDrop={handleDrop}
        />
      )}

      {menu && (
        <TreeContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {/* 重命名 */}
      <Modal
        title={renameTarget?.itemKind === 'folder' ? '重命名目录' : '重命名文档'}
        open={renameOpen}
        onOk={submitRename}
        onCancel={() => setRenameOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={renaming}
        okButtonProps={{ disabled: !renameValue.trim() }}
        width={420}
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={submitRename}
          maxLength={MAX_NAME}
          showCount
          autoFocus
        />
        <div className="vc-hint">重命名只改标题，不影响正文与已有向量。</div>
      </Modal>

      {/* 新建目录 */}
      <Modal
        title={folderParentId == null ? '新建文件夹' : `在「${itemMap.get(`f:${folderParentId}`)?.title ?? ''}」下新建文件夹`}
        open={folderOpen}
        onOk={submitCreateFolder}
        onCancel={() => setFolderOpen(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={creatingFolder}
        okButtonProps={{ disabled: !folderName.trim() }}
        width={420}
      >
        <Input
          placeholder="文件夹名称"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onPressEnter={submitCreateFolder}
          maxLength={MAX_NAME}
          showCount
          autoFocus
        />
        <div className="vc-hint">同一层级下不允许重名；名称中的斜杠会被拦截。</div>
      </Modal>

      {/* 移动到目录 */}
      <Modal
        title={`移动「${moveTarget?.title ?? ''}」`}
        open={moveTarget != null}
        onOk={submitMove}
        onCancel={() => setMoveTarget(null)}
        okText="移动"
        cancelText="取消"
        confirmLoading={moving}
        width={440}
      >
        <Select
          value={moveTo}
          onChange={(value: number) => setMoveTo(value)}
          options={folderOptions}
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
        />
        <div className="vc-hint">移动只改归属目录，不会让文档失效向量。</div>
      </Modal>

    </div>
  );
});

export default DocTree;
