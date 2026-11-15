# Proposal · P1 知识库文件夹树（文件夹 + 拖拽移动 + 右键菜单）

> 版本：v1.0（2026-11-15）
> 状态：待 review（人工确认「待确认」7 条后才 apply）
> 关联：`openspec/api-spec.md`（知识库契约）、`PROJECT_MEMORY.md` §3 vc-knowledge / §5 / §6 / §7.4

## 为什么做（Why）

当前知识库只支持「单文件创建 + 查看」：

- 后端 10 个接口全部以 `knowledge_doc` 为对象，**没有目录概念**；`GET /knowledge/list` 是按 `updated_at` 排序的平铺分页列表。
- 前端 `pages/Knowledge/index.tsx` 左侧是 `.vc-doc-item` 平铺按钮列表，文档一多只能靠关键词搜索，找不到「哪篇属于哪个主题」。
- 用户已明确诉求：**加文件夹来管理**，文件夹之间支持文档拖拽移动，右键可重命名 / 删除，整体按**树形**展示且**默认全展开**。

因此本轮把「文档库」升级为「文档树」：目录与文档同为树节点，移动/改名/删除都在树上完成，同时保持现有编辑器、向量化、RAG 召回链路完全不变。

## 做什么（What）

一句话：**新增 `knowledge_folder` 目录表 + `knowledge_doc.folder_id` 归属列，新增一棵树的读写接口，前端把平铺列表换成 antd `Tree`（默认全展开 + 原生拖拽 + 自定义右键菜单）。**

### 后端

1. `021_knowledge_folder.sql`：建 `knowledge_folder`（自引用 `parent_id`），给 `knowledge_doc` 加可空 `folder_id`。
2. `vc-knowledge` 新增 `KnowledgeFolder` 实体 / Mapper / `KnowledgeFolderService`，`KnowledgeService` 增加 `tree()` 与 `moveDoc()`。
3. `vc-app` 的 `KnowledgeController` 增加 6 个接口（目录 CRUD / 移动 / 树查询）+ 1 个文档重命名接口；沿用「登录即可」权限模型。

### 前端

1. 左侧栏由平铺列表换成 `Tree`：虚拟根节点「全部文档」→ 文件夹 → 文档，**首次加载全展开**。
2. 拖拽：文档 ↔ 文件夹、文件夹 ↔ 文件夹；**禁止拖入自身/后代**；拖拽先本地乐观更新，失败回滚。
3. 右键菜单：文件夹「新建子文件夹 / 新建文档 / 重命名 / 删除」；文档「重命名 / 移动到… / 删除」。
4. 搜索时保留祖先路径（不切成扁平结果），命中文档高亮。

## 范围（Scope）

### In-scope（本轮交付）

| 能力 | 说明 |
|---|---|
| 目录 CRUD | 新建（根级 / 子级）、重命名、删除（空目录直删，非空二次确认级联删） |
| 文档归属 | 新建时可指定目录；已有文档可拖拽/右键移动；`folder_id = NULL` 视为根级 |
| 树查询 | 一次返回 `{ folders, docs }` 扁平数组，前端组装；不做分页 |
| 拖拽移动 | 文档拖入文件夹、文档拖回根、文件夹拖成子文件夹、文件夹拖为兄弟 |
| 右键菜单 | 玻璃浮层，跟随光标，点外部 / Esc 关闭；键盘 `F2` 重命名 |
| 默认全展开 | 受控 `expandedKeys`，首次进入填满全部文件夹；折叠状态仅本次会话保留 |
| 搜索 | 命中文档 + 全部祖先目录，自动展开、命中片段高亮 |
| 无感刷新 | 所有变更走静默刷新 / 乐观更新，保留当前文档正文与展开态，仅右上角细进度条 |

### Out-of-scope（明确延后）

- ❌ 同级手动排序（拖拽只改归属，不改顺序）
- ❌ 多选 / 批量移动、批量打标、批量向量化
- ❌ 文件夹图标、颜色、备注、收藏、回收站
- ❌ 按用户隔离（沿用 §10.1「登录即可、全账号共享」；`knowledge_folder` 同样不加 `owner_id`，避免半套隔离）
- ❌ 对话页文档选择器改成树（继续用 `/knowledge/list`，仅后续补「路径前缀」展示）
- ❌ 文件系统式路径字符串（如 `a/b/c`）方案 —— 改名/移动要批量刷路径，不采用

## 影响面

### 数据库

- 新增表 `knowledge_folder`；`knowledge_doc` 加列 `folder_id`（可空，存量数据自动落在根级）。
- 不动 `knowledge_embedding`（级联删除时由应用层显式清理，与现 `delete()` 一致）。

### 后端

| 文件 | 动作 |
|---|---|
| `VeythCog-C/docs/sql/021_knowledge_folder.sql` | 新增 |
| `vc-knowledge/.../entity/KnowledgeFolder.java` | 新增 |
| `vc-knowledge/.../mapper/KnowledgeFolderMapper.java` + XML | 新增（含递归 CTE 取后代） |
| `vc-knowledge/.../dto/{FolderNode,DocNode,KnowledgeTree,FolderCreateRequest,FolderRenameRequest,MoveRequest}.java` | 新增 |
| `vc-knowledge/.../service/{KnowledgeFolderService,KnowledgeService}.java` + impl | 修改 / 新增 |
| `vc-knowledge/.../entity/KnowledgeDoc.java`、`dto/{DocListItem,DocDetail,DocSaveRequest}.java` | 加 `folderId` |
| `vc-knowledge/.../resources/mapper/KnowledgeDocMapper.xml` | 加按 `folder_id` 查询 / 递归目录统计 |
| `vc-app/.../web/KnowledgeController.java` | 加 7 个接口 |

### 前端

| 文件 | 动作 |
|---|---|
| `src/types/index.ts` | 新增 `KnowledgeFolderNode` / `KnowledgeDocNode` / `KnowledgeTree`，`DocListItem` / `DocDetail` / `DocSavePayload` 加 `folderId` |
| `src/api/knowledge.ts` | 新增 `getTree` / `createFolder` / `renameFolder` / `deleteFolder` / `moveFolder` / `moveDoc` / `renameDoc` |
| `src/pages/Knowledge/index.tsx` | 左侧列表改 `DocTree`；新建文档带上目标目录 |
| `src/pages/Knowledge/DocTree.tsx` | **新增**：Tree + 拖拽 + 右键菜单 + 搜索高亮 |
| `src/pages/Knowledge/tree.css` | **新增**：树行 / 右键菜单 / 拖拽落点样式（只用主题变量） |
| `src/stores/knowledgeStore.ts` | 不动（当前为遗留 `KnowledgeBase/Note` 结构，页面未使用） |
| `src/pages/Chat/index.tsx` | 不动（`listDocs` 行为保持） |

### 文档

- `openspec/api-spec.md` 增补本轮接口；`PROJECT_MEMORY.md` §3 / §5 / §6 / §7.4 同步；`VeythCog-V/docs/frontend-style-guide.md` 若要新增「树行 / 右键菜单」条目再补。

## 验收总则（每条都可演示）

启动前后端 → 登录 → 进入 `/knowledge`：

1. 左侧显示虚拟根「全部文档」→（已有目录）→ 文档，**一进来全部展开**；折叠一个目录后，刷新页面回到全展开。
2. 头部「新建文件夹」建根级目录；右键目录「新建子文件夹」建子级；同级重名被拦截并提示。
3. 右键目录「重命名」改名成功，树立即更新，不闪整块 Spin；文档改名**不改变向量化状态**。
4. 把文档 A 拖到文件夹 B → 立即显示在 B 下；再拖回根节点 → 回到根级；刷新后位置一致。
5. 把文件夹 C 拖进它的子目录 D → 前端禁止落点，即使强行请求后端也返回「不能移动到自身或子目录」。
6. 删除空目录 → 直接删除；删除非空目录 → 二次确认（提示将删除 N 个文档 / M 个子目录）→ 确认后整支消失，被删文档的向量记录同步清理。
7. 搜索关键词 → 树上只保留命中文档及其祖先目录，命中片段高亮，其余隐藏；清空搜索恢复完整树与原有展开态。
8. 打开文档 → 编辑、保存、向量化、导出、删除全部与现状一致；切换到另一篇时正文不闪、不整块 Spin。
9. 对话页「选择知识库文档」抽屉仍能列出全部文档（含树内任意层级），RAG 召回不受影响。
10. 质量门：后端 `mvn compile` 通过、前端 `npm run build`（tsc + vite）通过；`/api/doc.html` 手测 7 个新接口。

## 待确认（review 时逐条拍板，括号为推荐）

1. **非空文件夹删除策略**：级联软删（含子目录与文档，二次确认，推荐，文件管理器直觉）／ 禁止删除，必须先清空（与导航分类 `nav_category` 规则一致）。默认按**级联 + 二次确认**实现。
2. **根级拖放入口**：树顶加一个虚拟根节点「全部文档」（推荐，可直接把文档/文件夹拖回根，且天然承载全展开）／ 不加根节点，只能右键「移动到根目录」。默认按**虚拟根节点**实现。
3. **同级文档是否手动排序**：本轮不做（按「更新时间倒序」，文件夹按名称升序，推荐）／ 需要拖拽排序（要加 `knowledge_doc.sort_order` + 重排接口，工作量 +0.5d）。
4. **折叠状态是否持久化**：不持久化（默认全展开是明确诉求，推荐；折叠只在本次会话有效）／ 持久化到 `localStorage`。
5. **文件夹同名规则**：同级禁止重名（唯一索引兜底，推荐）／ 允许重名（靠 `id` 区分）。
6. **文档重命名是否同步正文首个 H1**：不同步（推荐，改标题不重写正文、不影响向量）／ 同步改正文首个 `# ` 标题。
7. **删除文件夹后对话会话里残留的 `rag_doc_ids`**：不清理（召回端按 `deleted` 过滤，全失效时编排器降级为普通对话，推荐）／ 顺手清理 `chat_session.rag_doc_ids`。
