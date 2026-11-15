# Design · P1 知识库文件夹树

> 版本：v1.0（2026-11-15）
> 状态：待 review
> 前置阅读：`openspec/api-spec.md`、`PROJECT_MEMORY.md` §3 vc-knowledge、§7.4 无感刷新规范、`VeythCog-V/docs/frontend-style-guide.md`

---

## 0. 现状与硬约束（读代码得出，不是猜的）

| 事实 | 位置 | 对本设计的影响 |
|---|---|---|
| 知识库域**没有目录概念**，10 个接口全以 `knowledge_doc` 为对象 | `vc-app/web/KnowledgeController.java` | 目录必须新增表 + 新增接口，不能塞进 `knowledge_doc` 的字段里 |
| `vc-knowledge` 无 Controller，Controller 全在 `vc-app` | `vc-app/web/*` | 新接口加在现有 `KnowledgeController`，保持模块依赖方向不变 |
| 列表 `selectDocList` 会查出 `block_data` / `markdown_text`（重字段） | `KnowledgeDocMapper.xml` | 树查询必须另建轻量 select，否则一次拉全量会拖慢侧栏 |
| `update()` 只要被调用就 `isVectorized=false` | `KnowledgeServiceImpl.update` | **文档改名不能走 `PUT /knowledge/doc/{id}`**，必须单独接口，否则改个名字向量就失效 |
| 删除是软删 + 显式清理 embedding（不依赖 FK 级联） | `KnowledgeServiceImpl.delete` | 目录级联删除要复用同一套「软删 + 清向量」逻辑 |
| 前端左侧是 `.vc-doc-item` 平铺按钮，无树 | `pages/Knowledge/index.tsx` | 侧栏整体替换为 `DocTree`；文档头部/编辑器部分基本不动 |
| 对话页复用 `listDocs` 拉全量文档做 RAG 勾选 | `pages/Chat/index.tsx:149` | `/knowledge/list` 行为不能破坏，本轮不动聊天页 |
| `knowledgeStore.ts` 是遗留 `KnowledgeBase/Note` 结构，页面未使用 | `stores/knowledgeStore.ts` | 本轮不动它，避免顺手删出问题 |
| 全站无拖拽库，antd 5.15 的 `Tree` 自带 `draggable` | `package.json` | **不引新依赖**，用 antd 原生拖拽 |
| 无感规范：变更后静默刷新、切详情保留旧内容 + 细进度条 | `PROJECT_MEMORY.md` §7.4 | 树的所有变更走乐观更新 / 静默刷新，禁止整块 `<Spin />` |

---

## 1. 数据模型

### 1.1 DDL（`VeythCog-C/docs/sql/021_knowledge_folder.sql`，幂等）

```sql
-- 1. 目录表：自引用 parent_id，NULL = 根级
CREATE TABLE IF NOT EXISTS knowledge_folder (
    id          BIGSERIAL PRIMARY KEY,
    parent_id   BIGINT       NULL REFERENCES knowledge_folder(id),
    name        VARCHAR(100) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,   -- 预留手动排序，本轮恒为 0
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted     BOOLEAN      NOT NULL DEFAULT false
);

COMMENT ON TABLE  knowledge_folder IS '知识库目录（自引用树，软删除）';
COMMENT ON COLUMN knowledge_folder.parent_id IS '父目录 id；NULL = 根级';

-- 2. 文档归属列（存量数据 NULL → 落在根级，无需回填）
ALTER TABLE knowledge_doc
    ADD COLUMN IF NOT EXISTS folder_id BIGINT NULL REFERENCES knowledge_folder(id);

COMMENT ON COLUMN knowledge_doc.folder_id IS '所属目录 id；NULL = 根级';

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_folder_parent
    ON knowledge_folder (parent_id, deleted);

-- 同级不重名（含根级；软删后可复用同名）
-- NULL 在唯一索引里不参与去重，故用 COALESCE(parent_id, 0) 兜根级
CREATE UNIQUE INDEX IF NOT EXISTS uk_knowledge_folder_sibling_name
    ON knowledge_folder (COALESCE(parent_id, 0), name)
    WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_knowledge_doc_folder
    ON knowledge_doc (folder_id, deleted);
```

> 不采用「路径字符串」（`a/b/c`）：改名/移动要批量重刷所有后代路径，且拼串后做前缀查询容易踩转义坑。自引用 + 递归 CTE 更稳。
> 不加 `owner_id`：与 §10.1 一致（登录即可、全账号共享），避免出现半套隔离。

### 1.2 实体

`KnowledgeFolder`（MyBatis-Plus 注解，`@TableLogic` 与 `KnowledgeDoc` 一致）：

```java
@TableName("knowledge_folder")
public class KnowledgeFolder implements Serializable {
    @TableId(type = IdType.AUTO) private Long id;
    private Long parentId;      // NULL = 根级
    private String name;
    private Integer sortOrder;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    @TableLogic(value = "false", delval = "true") private Boolean deleted;
}
```

`KnowledgeDoc` 增加：

```java
/** 所属目录；NULL = 根级 */
private Long folderId;
```

---

## 2. API 契约（context-path `/api`，统一 `BaseResponse`）

| # | 方法 | 路径 | 请求 | 返回 | 说明 |
|---|---|---|---|---|---|
| 1 | GET | `/knowledge/tree` | `keyword?` | `KnowledgeTree` | 一次拉全树（轻量字段）；`keyword` 非空时只返回命中文档 + 其祖先目录 |
| 2 | POST | `/knowledge/folder` | `{parentId?, name}` | `Long`（新 id） | 新建目录；`parentId` 为空 = 根级 |
| 3 | PUT | `/knowledge/folder/{id}` | `{name}` | `void` | 重命名（只改 name/updated_at） |
| 4 | DELETE | `/knowledge/folder/{id}?recursive=false` | - | `void` | 空目录直删；非空且 `recursive=false` → `40000`；`recursive=true` → 递归软删子目录 + 文档 + 清向量 |
| 5 | GET | `/knowledge/folder/{id}/stats` | - | `{docCount, folderCount}` | 删除二次确认用（递归统计，避免前端按被搜索裁剪后的树估算） |
| 6 | POST | `/knowledge/folder/{id}/move` | `{parentId?}` | `void` | 移动目录；`parentId` 为空 = 移到根 |
| 7 | POST | `/knowledge/doc/{docId}/move` | `{folderId?}` | `void` | 移动文档；`folderId` 为空 = 移到根 |
| 8 | PUT | `/knowledge/doc/{docId}/title` | `{title}` | `void` | **只改标题**，不动正文、不置 `isVectorized=false` |

### 2.1 树响应结构

```json
{
  "code": 0,
  "data": {
    "folders": [
      { "id": 3, "parentId": 1, "name": "后端", "sortOrder": 0 },
      { "id": 1, "parentId": null, "name": "面试", "sortOrder": 0 }
    ],
    "docs": [
      {
        "id": 12, "folderId": 3, "title": "Spring AI 记忆机制",
        "summary": "……", "tags": ["后端"], "isVectorized": true, "updatedAt": 1730000000000
      }
    ],
    "total": 12,
    "matchedCount": 3
  }
}
```

- **扁平返回、前端组装**：目录量级小（个人知识库），扁平数组让前端做拖拽乐观更新、祖先展开都更简单，也避免后端递归序列化。
- `matchedCount`：`keyword` 为空时等于 `total`；非空时为命中文档数。
- `docs` 不带 `blockData` / `markdownText`（轻量 select：`id, folder_id, title, summary, tags, is_vectorized, updated_at`）。

### 2.2 校验与错误码（`ErrorCode` 现有枚举，HTTP 恒 200 + bizCode）

| 场景 | code | message |
|---|---|---|
| 目录名空白 / 超 100 字 / 含 `/` 或控制字符 | 40000 | 目录名需 1~100 字，且不能包含 `/` |
| 同级目录重名 | 40000 | 同级已存在同名目录 |
| 目录不存在 / 已删除 | 40400 | 目录不存在 |
| 目录层级超过 8 层 | 40000 | 目录层级过深（最多 8 层） |
| 移动到自身或自己的子目录 | 40000 | 不能移动到自身或其子目录 |
| 非空目录删除且 `recursive=false` | 40000 | 目录非空，请先清空或选择递归删除 |
| 文档不存在 | 40400 | 文档不存在 |
| 目标 `folderId` 指向已删目录 | 40000 | 目标目录不存在或已删除 |

> 前端把 `40000` 一律按 `message` 原样 toast；不做 409/HTTP 语义，保持与全站一致。

---

## 3. 后端设计

### 3.1 新增 / 改动清单

```
vc-knowledge/src/main/java/com/vc/knowledge/
├── entity/KnowledgeFolder.java                 新增
├── mapper/KnowledgeFolderMapper.java           新增（继承 BaseMapper + 3 个 XML 方法）
├── dto/
│   ├── FolderNode.java                         新增
│   ├── DocNode.java                            新增
│   ├── KnowledgeTree.java                      新增（folders + docs + total + matchedCount）
│   ├── FolderCreateRequest.java                新增 {parentId, name}
│   ├── FolderRenameRequest.java                新增 {name}
│   ├── MoveRequest.java                        新增 {parentId} / 复用为 {folderId} 语义
│   └── FolderStats.java                        新增 {docCount, folderCount}
├── service/
│   ├── KnowledgeFolderService.java             新增
│   └── impl/KnowledgeFolderServiceImpl.java    新增
└── service/KnowledgeService.java               修改：+ tree() / moveDoc() / renameTitle()
resources/mapper/KnowledgeFolderMapper.xml      新增（递归 CTE）
resources/mapper/KnowledgeDocMapper.xml         修改：+ selectTreeDocs / + 按目录统计 / + 批量软删
```

`KnowledgeController`（`vc-app`）新增 8 个方法，鉴权沿用现有 `currentUserIdOrNull()`（当前未启用隔离，只要求登录）。

### 3.2 服务签名

```java
public interface KnowledgeFolderService {
    KnowledgeTree tree(String keyword);
    Long create(Long parentId, String name);
    void rename(Long folderId, String name);
    void delete(Long folderId, boolean recursive);
    FolderStats stats(Long folderId);
    void move(Long folderId, Long targetParentId);
}
```

`KnowledgeService` 追加：

```java
void moveDoc(Long userId, Long docId, Long folderId);
void renameTitle(Long userId, Long docId, String title);
```

### 3.3 关键 SQL（`KnowledgeFolderMapper.xml`）

后代集合（移动环检测 + 递归删除共用）：

```sql
<select id="selectDescendantIds" resultType="java.lang.Long">
  WITH RECURSIVE sub AS (
    SELECT id FROM knowledge_folder WHERE id = #{folderId} AND deleted = false
    UNION ALL
    SELECT f.id FROM knowledge_folder f
    JOIN sub s ON f.parent_id = s.id
    WHERE f.deleted = false
  )
  SELECT id FROM sub
</select>
```

说明：MP 的 `@TableLogic` 不作用于自定义 XML，所有自定义 SQL **必须显式带 `deleted = false`**（这点与现有 `selectDocList` 一致）。

批量软删子目录 / 文档：

```sql
UPDATE knowledge_folder SET deleted = true, updated_at = now()
 WHERE id IN (...) AND deleted = false;

UPDATE knowledge_doc SET deleted = true, updated_at = now()
 WHERE folder_id IN (...) AND deleted = false;
```

（按 200 个 id 一批执行，避免超长 SQL；与 `embedding_mapper.delete(docIds)` 在同一事务内，顺序：文档软删 → 向量删除 → 目录软删。）

### 3.4 树组装算法（Java 侧，O(n)）

1. 查全部未删目录（`id, parent_id, name, sort_order`）。
2. 查未删文档轻量行；`keyword` 非空时走 `to_tsvector('simple', ...) @@ plainto_tsquery(...)`（复用现有 GIN 索引表达式）。
   - **实现期修订（2026-11-15）**：实测 PG `simple` 分词不切中文，`plainto_tsquery('simple','检索引擎')`（单 token `检索引擎`）与 `to_tsvector('simple','检索引擎笔记')`（单 token `检索引擎笔记`）永远不匹配，中文关键词命中 0。故条件改为
     `title ILIKE '%kw%' OR coalesce(summary,'') ILIKE '%kw%' OR to_tsvector(...) @@ plainto_tsquery(...)`：
     标题/摘要用子串匹配（中文可靠、数据量小），正文仍交给 tsvector + GIN 索引兜长文本。
3. `keyword` 非空 → 从命中文档的 `folderId` 沿 `id→parentId` 上溯，收集祖先目录集合；未命中的目录不进 `folders`。
4. 返回扁平数组，不动排序（前端组装时排序），避免前后端两套排序规则打架。

### 3.5 环检测与层级

```java
// moveFolder(folderId, targetParentId)
if (targetParentId != null) {
    if (targetParentId.equals(folderId)) throw PARAMS("不能移动到自身");
    Set<Long> descendants = mapper.selectDescendantIds(folderId);  // 含自身
    if (descendants.contains(targetParentId)) throw PARAMS("不能移动到自身或其子目录");
    checkDepth(targetParentId, maxDepth = 8);
}
```

`checkDepth`：从 `targetParentId` 循环取 `parentId` 计数，超过 8 抛出。

### 3.6 性能

- 树 = 2 条 select（目录全量 + 文档轻量全量），无递归序列化；1000 篇文档预计 < 20ms（本地库）。
- `/knowledge/tree` 不缓存：数据变动频繁，先以简单为准；若后续 > 3000 篇再加 `updated_at` 版本号缓存。
- `stats` 用 `COUNT(*)` 两次（`folder_id IN (...)`），仅删除确认时调用。

---

## 4. 前端设计

### 4.1 类型（`src/types/index.ts`）

```ts
export interface KnowledgeFolderNode {
  id: number;
  parentId: number | null;
  name: string;
  sortOrder: number;
}

export interface KnowledgeDocNode {
  id: number;
  folderId: number | null;
  title: string;
  summary: string;
  tags: string[];
  isVectorized: boolean;
  updatedAt: number;
}

export interface KnowledgeTree {
  folders: KnowledgeFolderNode[];
  docs: KnowledgeDocNode[];
  total: number;
  matchedCount: number;
}

// 已有类型补字段
DocListItem     + folderId: number | null;
DocDetail       + folderId: number | null;
DocSavePayload  + folderId?: number | null;   // 仅新建时使用
```

### 4.2 API（`src/api/knowledge.ts`）

```ts
getTree(params?: { keyword?: string }): Promise<KnowledgeTree>
createFolder(parentId: number | null, name: string): Promise<number>
renameFolder(id: number, name: string): Promise<void>
deleteFolder(id: number, recursive?: boolean): Promise<void>
getFolderStats(id: number): Promise<{ docCount: number; folderCount: number }>
moveFolder(id: number, parentId: number | null): Promise<void>
moveDoc(docId: number, folderId: number | null): Promise<void>
renameDoc(docId: number, title: string): Promise<void>
```

### 4.3 树数据模型（`DocTree.tsx` 内部）

```ts
type TreeKey = `root` | `f:${number}` | `d:${number}`;

interface TreeItem {
  key: TreeKey;
  kind: 'root' | 'folder' | 'doc';
  id?: number;              // root 无 id
  title: string;
  parentId: number | null;  // root 恒为 null
  folderId: number | null;  // doc 用
  node?: KnowledgeDocNode;  // doc 附带完整元信息（标签/时间/向量标记）
  children?: TreeItem[];
  docCount?: number;        // folder 递归文档数（组装时算）
}
```

组装规则（`buildTree(tree: KnowledgeTree): TreeItem[]`）：

1. 建 `root` 节点（`title = 全部文档`，`expanded` 常开，`selectable: false`，`draggable: false`）。
2. 文件夹挂到 `parentId`（`null` → root），**文件夹按 `name` 升序**（`localeCompare('zh-CN')`）。
3. 文档挂到 `folderId`（`null` → root），**按 `updatedAt` 倒序**。
4. 文件夹排在文档之前；空目录也显示（用「空目录」灰字占位行或允许无 children）。
5. 递归计算 `docCount`（目录右侧灰色数字，如 `12`）。

### 4.4 展开态（默认全展开的正确实现）

antd 的 `defaultExpandAll` 只在**挂载时数据已就绪**才生效；本项目数据是异步拉的，直接用会在「首屏空 → 数据到」时保持全收起。因此：

```ts
const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
const initedRef = useRef(false);

// 首次拿到树 → 填满全部 key（含 root），之后不再重填
useEffect(() => {
  if (!initedRef.current && treeData.length > 0) {
    initedRef.current = true;
    setExpandedKeys(collectFolderKeys(treeData));
  }
}, [treeData]);
```

规则：

| 事件 | `expandedKeys` 处理 |
|---|---|
| 首次加载 | 全部目录 key + `root` |
| 新建目录 | `union([新 key, 父 key])`，自动展开到能看见新目录 |
| 删除/级联删除 | 移除被删子树的所有 key |
| 拖拽移动 | 保证目标目录 key 在集合内（拖进收起目录时自动展开） |
| 搜索 | 临时设为返回树中的所有 key；清空搜索时回滚到快照 `expandedSnapshotRef` |
| 折叠 | 用户主动折叠 → 仅本次会话保留（不写 localStorage），刷新回到全展开 |

### 4.5 拖拽规则矩阵（antd `onDrop`）

`info` 字段用法：`dragNode`（被拖节点）、`node`（落点节点）、`dropToGap`（是否落在节点之间的间隙）、`dropPosition`（相对位置）。

| 被拖 | 落点 | `dropToGap` | 目标 `parentId` / `folderId` | 处理 |
|---|---|---|---|---|
| 文档 | 目录 | false | `folderId = 目录 id` | 移入目录 |
| 文档 | 目录 | true | `folderId = 目录的 parentId` | 成为该目录的兄弟（v1 不排序） |
| 文档 | 文档 | true | `folderId = 目标文档的 folderId` | 落到目标文档所在目录 |
| 文档 | 文档 | false | — | 拒绝（`allowDrop` 返回 false） |
| 文档 | root | false | `folderId = null` | 回到根级 |
| 目录 | 目录 | false | `parentId = 目录 id` | 成为子目录 |
| 目录 | 目录 | true | `parentId = 目标目录的 parentId` | 成为兄弟目录 |
| 目录 | 文档 | true | `parentId = 目标文档的 folderId` | 成为该层兄弟 |
| 目录 | 文档 | false | — | 拒绝 |
| 目录 | root | false | `parentId = null` | 回到根级 |
| 任意 | 自身 | — | — | `allowDrop` 拒绝 |
| 目录 | 自己的后代 | — | — | `allowDrop` 拒绝（前端有完整树，可直接判定） |

`allowDrop({ dragNode, dropNode, dropPosition })`：前端判定「自身 / 后代 / doc 内部落点」一律返回 false，给出视觉上的禁止光标；后端再做一次同样校验兜底。

落点视觉（只用 `transform` / `opacity` / 背景色）：

- 目录内落点：整行高亮 `colors.primary10` + 1px 内描边；
- 间隙落点：2px 品牌色横线（`colors.primary`），`translateY(±1px)` 微动；
- 禁止：整行 `colors.error` 10% 底 + `cursor: not-allowed`。

### 4.6 右键菜单（`TreeContextMenu`）

- 触发：`Tree.onRightClick(({ event, node }) => { event.preventDefault(); setMenu({x: event.clientX, y: event.clientY, node}); })`。
- 呈现：`position: fixed` 的玻璃浮层（`colors.surfaceOverlay` + `backdrop-filter: blur(18px)` + `colors.glassBorder`，与现有玻璃卡一致），`z-index` 高于侧栏，超出视口时自动向左/向上翻转（`x > innerWidth - 220` 则 `right` 定位）。
- 关闭：`mousedown` 外部、`Esc`、滚动、路由切换、执行任一菜单项后。
- 菜单项：

| 节点 | 菜单项 |
|---|---|
| root | 新建文件夹 |
| 目录 | 新建子文件夹 · 新建文档 · 重命名 · 删除（红色） |
| 文档 | 重命名 · 移动到…（弹窗选目录）· 删除（红色） |

- 「移动到…」作为拖拽的键盘/触屏替代入口：弹窗内用同一棵树做单选（可选「根目录」）。
- 键盘：`F2` 对当前选中节点进入重命名；`Delete` 不绑定（防误删）。

### 4.7 重命名

- 统一 `Modal` + `Input`（不用行内 input，避免 antd Tree 节点重渲染导致展开态抖动）。
- 目录：`renameFolder`；文档：`renameDoc`（**只改标题**，不触发 `update()`，因此不会把 `isVectorized` 打成 false）。
- 校验：trim 后非空、≤100、不含 `/`；同级重名前端先提示，后端唯一索引兜底。
- 成功后原地更新 `treeData` 对应 `title`，不重新拉树（无感）；同时若改的是当前打开的文档，同步更新头部标题与 `detail.title`，**不重拉详情**（避免 `DocEditor` 重解析）。

### 4.8 删除

- 文档删除：沿用 `DELETE /knowledge/doc/{id}`（软删 + 清向量），删除后若为当前打开文档则清空编辑器（现有行为）。
- 目录删除：
  1. `getFolderStats(id)` 拿 `docCount / folderCount`；
  2. 为空 → 直接删；
  3. 非空 → `Modal.confirm`：`将删除「X」及其下 3 个目录、12 篇文档，删除后不可从界面恢复`；
  4. 确认 → `deleteFolder(id, true)`；成功后从 `treeData` 摘掉该子树（乐观），并静默刷新一次兜底。

### 4.9 搜索

- 输入 `keyword`（300ms 防抖）→ `getTree({ keyword })`。
- 树只展示命中文档与祖先目录；`matchedCount` 显示「命中 N 篇」。
- 命中片段高亮：标题按 `keyword` 切分，命中段包 `<span className="vc-tree__hit">`（背景 `colors.primary15` + `colors.primary` 文字）。
- 清空搜索：用快照恢复完整树与搜索前的 `expandedKeys`，**不重新请求**（完整树已缓存在 `fullTreeRef`）。
- 搜索态下禁用拖拽（`draggable=false`），避免在裁剪树上移动导致语义歧义。

### 4.10 组件拆分与无感刷新

```
pages/Knowledge/
├── index.tsx         // 页面壳（列表 → DocTree，其余逻辑保留）
├── DocTree.tsx       // 树 + 拖拽 + 右键 + 行内标题渲染（新增）
├── TreeContextMenu.tsx // 玻璃右键浮层（新增）
├── tree.css          // 树行 / 落点 / 菜单样式（新增）
└── DocEditor.tsx     // 不动
```

| 操作 | 刷新策略 |
|---|---|
| 拖拽移动 | **乐观更新**（先改本地树）→ 请求 → 失败回滚 + `message.error`，不重拉 |
| 新建 / 重命名 / 删除 | 本地修改 → `getTree({silent:true})` 静默兜底 |
| 打开文档 / 切换文档 | 保留旧正文 + 右上角 `vc-doc-progress` 细进度条（现有实现不动） |
| 保存 / 向量化 | 现有乐观更新逻辑不动（只更新元信息，不重拉详情） |

静默刷新约定：`loadTree({ silent: true })` 不切 `loading`（不闪 `Spin`），只在 `fullTreeRef` 与 `treeData` 原地替换。

### 4.11 视觉落地（遵循 `frontend-style-guide.md`）

- 树容器复用 `.vc-subnav` / `.vc-knowledge-nav` 现有布局与玻璃背景，不新造卡片。
- 行高 30px（紧凑），缩进 14px；文件夹图标 `folder` / 展开 `folder-open`（lucide iconify，已有依赖），文档图标 `file-text`（复用现有）。
- 文档行信息沿用现有 `.vc-doc-item` 的取舍：标题 + 最多 3 个软标签 + 相对时间 + `zap` 向量标记；**行内不再显示摘要**（树里每行只能一行，摘要放到右侧详情头部）。
- 颜色只取 `useTheme().colors` 或 `--color-*`；菜单与落点不得硬编码 `#7C3AED`。
- 动效只改 `transform/opacity`，`prefers-reduced-motion` 下关闭菜单入场动画。

---

## 5. 边界与异常

| 场景 | 行为 |
|---|---|
| 存量文档 `folder_id = NULL` | 全部显示在根节点下，无需迁移脚本回填 |
| 目录被软删，其下文档未删（异常数据） | `tree()` 只返回 `folder_id` 仍有效的文档；孤儿文档归到根级并打 WARN（防御性兜底） |
| 删除当前打开的文档所在目录（级联） | 若当前 `activeDocId` 在受影响集合内，清空右侧编辑器并提示「当前文档所在目录已删除」 |
| 拖拽后目标目录被他人删除（并发） | 后端 `40000 目标目录不存在或已删除`，前端回滚本地树 + 静默刷树 |
| 搜索态下拖拽 | 禁用 |
| 目录循环引用（历史脏数据） | `tree()` 组装时检测到环 → 该支不挂载并打 WARN，不抛异常阻塞页面 |
| 目录层数 > 8 的存量数据 | 允许读，只禁止再往下建/移 |
| 名称含 `\`、换行、emoji | 允许 emoji；拒绝 `/`、控制字符、首尾空白（trim 后存） |

---

## 6. 兼容与迁移

1. `009 → 021` 顺序执行；`021` 幂等（`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`）。
2. `009_knowledge.sql` **不改**（新库执行到 021 即可）；`openspec/sql/knowledge-init.sql` 仍废弃，勿用。
3. `/knowledge/list` 行为不变（仍返回全量平铺文档），对话页、`Chat` 的 RAG 勾选零影响；`DocListItem` 多一个 `folderId` 字段属向后兼容。
4. `PUT /knowledge/doc/{docId}` 语义不变（仍置 `isVectorized=false`）；移动/改名走新接口。
5. 前端 `DocListItem` 新增字段为可选扩展，`Chat` 页无需改动。
6. `chat_session.rag_doc_ids` 中被级联删除的 id 不主动清理：`VectorizeServiceImpl.selectDocs` 会过滤已删文档，全失效时抛 `文档不存在`，由 `RagChatOrchestrator` 现有降级逻辑转普通对话（待验证项见下）。

---

## 7. 风险与验证点（apply 时必须逐条过）

1. **antd `defaultExpandAll` 异步失效** → 已改为受控 `expandedKeys`（§4.4），实现后必须验证「首次进入全展开」。
2. **文档改名误置 `isVectorized=false`** → 新增独立 `/title` 接口；验证方式：改名后查看行内 `zap` 标记仍在、DB `is_vectorized` 仍为 true。
3. **拖拽落点语义歧义**（`dropToGap` 组合多）→ 按 §4.5 矩阵写单测级别的判定函数 `resolveDropTarget()`，并在真机逐条点一遍。
4. **递归删除事务过大** → 分批 `IN` + 同事务；在 500 篇文档的目录上实测耗时，超过 5s 则改异步任务（本轮先同步）。
5. **树查询漏 `deleted = false`**（自定义 XML 不走 MP 逻辑删除）→ code review 必查；用「软删一个目录后树里必须消失」验收。
6. **`rag_doc_ids` 残留** → 删除一个曾被会话引用的目录后，在对话页发消息验证降级为普通对话（不报 500）。
7. **同名唯一索引在根级的表现** → 根级建两个同名目录必须被拒（`COALESCE(parent_id, 0)` 生效）。
8. **窄侧栏里拖拽误触** → 侧栏宽度 < 220px 时，`blockNode` + 行高 30px 必须保证拖拽热区 ≥ 28px；在 1366×768 分辨率实测。
9. **无感规范** → 拖拽/改名/删除全过程不得出现整块 `<Spin />`、不得让右侧正文闪动或丢光标。

---

## 8. 工作量估算

| 阶段 | 内容 | 估时 |
|---|---|---|
| 1 | DDL + 实体 + Mapper（含递归 CTE） | 0.4d |
| 2 | 树查询 / 目录 CRUD / 移动 / 改名 / 统计接口 | 0.6d |
| 3 | 前端类型 + API + `buildTree` / `resolveDropTarget` | 0.5d |
| 4 | `DocTree` + 右键菜单 + 拖拽 + 搜索高亮 + 样式 | 1.0d |
| 5 | 联调 + 9 条验证点 + 质量门 | 0.5d |
| 6 | 文档同步（api-spec / PROJECT_MEMORY / 视觉规范） | 0.3d |
| **合计** | | **≈ 3.3d** |
