# Tasks · P1 知识库文件夹树

> 版本：v1.1（2026-11-15 执行后回填）
> 执行顺序：评审拍板 → 建表 → 后端接口 → 前端 API/组装 → 树组件 → 联调验收 → 文档同步。
> 每项完成后打 `[x]`；编译/运行/构建不通过不算完成。`[~]` 表示部分完成/降级验证，说明见文末「执行记录」。

---

## 阶段 0：评审与准备（0.3d）

- [x] 0.1 评审 `proposal.md` / `design.md`，逐条拍板「待确认」7 条 — 用户 2026-11-15 回复「按你默认的来」，7 条推荐默认项全部采纳
- [x] 0.2 确认后端 `vc-knowledge` 新增包结构（Controller 仍留在 `vc-app`）
- [x] 0.3 确认「根级 = `folder_id NULL`」，前端虚拟根节点 `key='root'` 不落库

## 阶段 1：数据库（0.3d）

- [x] 1.1 新增 `VeythCog-C/docs/sql/021_knowledge_folder.sql`
  - [x] `knowledge_folder` 建表（`id / parent_id / name / sort_order / created_at / updated_at / deleted`）
  - [x] `knowledge_doc ADD COLUMN IF NOT EXISTS folder_id BIGINT NULL REFERENCES knowledge_folder(id)`
  - [x] 索引：`idx_knowledge_folder_parent (parent_id, deleted)`、`idx_knowledge_doc_folder (folder_id, deleted)`
  - [x] 唯一索引：`(COALESCE(parent_id, 0), name) WHERE deleted = false`
- [x] 1.2 在开发库（腾讯云 `111.230.146.233`）执行脚本并核对结构/索引（10 条语句全 OK）
- [x] 1.3 幂等（脚本内 `IF NOT EXISTS`）；复跑安全

## 阶段 2：后端（1.0d）

- [x] 2.1 `entity/KnowledgeFolder.java`
- [x] 2.2 `KnowledgeDoc.java` 增加 `folderId`；`DocListItem` / `DocDetail` / `DocSaveRequest` 同步加字段
- [x] 2.3 `KnowledgeFolderMapper.java` + `KnowledgeFolderMapper.xml`
  - [x] `selectDescendantIds`（递归 CTE，显式 `deleted = false`）
  - [x] `countDocsByFolderIds`（+ `countFoldersByFolderIds` 以 `selectDescendantIds` 尺寸推导）
  - [x] `softDeleteDocsByFolderIds` / `softDeleteFolders`
- [x] 2.4 `KnowledgeDocMapper.xml` 增加：
  - [x] `selectTreeDocs`（轻量字段，keyword 检索，**不带** `block_data` / `markdown_text`）
  - [x] `updateFolderId`（单条移动，允许置 NULL）
  - [x] 标题改名复用 MyBatis-Plus 局部更新（仅 `title` / `updated_at`），未新增 `updateTitle`
- [x] 2.5 `KnowledgeFolderService` + `impl`
  - [x] `tree(keyword)`：目录全量 + 文档轻量，keyword 时保留祖先路径；孤儿兜底
  - [x] `create`：非空 / ≤100 / 无 `/`、控制字符；同级重名；层级 ≤8
  - [x] `rename`：同上（排除自身重名）
  - [x] `delete`：非空且非递归 → `40000`；递归 → 清 embedding + 分批软删文档 + 软删目录（同一事务）
  - [x] `stats`：递归 `docCount / folderCount`
  - [x] `move`：自身 / 后代环检测 + 层级校验
- [x] 2.6 `KnowledgeService` 增加 `moveDoc(docId, folderId)`、`renameTitle(docId, title)`（只动 title，不置 `is_vectorized=false`）
- [x] 2.7 `KnowledgeController` 增加 8 个接口
- [x] 2.8 `mvn -o -pl vc-app -am -DskipTests -q package` 通过（BUILD_EXIT=0）
- [x] 2.9 接口冒烟（脚本 `smoke-tree3.ps1`，比 swagger 手点更可复现）全绿

## 阶段 3：前端 API 与数据组装（0.5d）

- [x] 3.1 `src/types/index.ts`：`KnowledgeFolderNode` / `KnowledgeDocNode` / `KnowledgeTree`；`DocListItem` / `DocDetail` / `DocSavePayload` 加 `folderId`
- [x] 3.2 `src/api/knowledge.ts`：8 个函数（`deleteFolder` 的 `recursive` 拼进 path，因 `http.del` 无 query 参数）
- [x] 3.3 `DocTree.tsx` 内纯函数：`buildTree`（root → 目录按名称升序 → 文档 `updatedAt` 倒序 + 递归 `docCount`）、`collectFolderKeys`、`isDescendant`（以 `handleAllowDrop` 形式内联）、落点解析（`handleDrop` + `dropToGap`）

## 阶段 4：前端树组件（1.0d）

- [x] 4.1 `index.tsx`：`docs` → `tree` + `fullTreeRef` 快照；`loadFullTree` / `searchTree`
- [x] 4.2 `DocTree.tsx` 基础渲染（虚拟根「全部文档 (N)」、目录行 docCount 徽标、文档行 zap + 相对时间 + 选中高亮）
- [x] 4.3 **默认全展开**：受控 `expandedKeys` + `initedRef / knownKeysRef`，新建目录自动展开父链
- [x] 4.4 选中与打开：`selectedKeys=['d:'+activeDocId]`，复用现有 `selectDoc` 静默加载
- [x] 4.5 拖拽：`draggable` + `allowDrop` + `onDrop`；乐观本地移动 + 失败回滚 + `onRefresh({silent:true})`；落点视觉见 `tree.css`
- [x] 4.6 右键菜单 `TreeContextMenu.tsx`（玻璃浮层、贴边翻转、外部点击/Esc/scroll 关闭）
- [x] 4.7 重命名弹窗：目录 / 文档分别走 `renameFolder` / `renameDoc`
- [x] 4.8 删除流程：`getFolderStats` → 非空 `Modal.confirm` 级联提示 → `deleteFolder(id, true)`
- [x] 4.9 搜索：300ms 防抖、命中高亮、搜索态记录/恢复快照
- [x] 4.10 新建文档/导入带 `folderId`；导入 md 后归入当前目录
- [x] 4.11 `tree.css`（未动用户正在改的 `page.css`）：30px 行高、玻璃选中态、落点指示线、右键菜单入场动画
- [~] 4.12 无感走查：**仅代码层面遵守**（无整块 `<Spin/>`、静默刷新），**未在浏览器做交互验收**
- [x] 4.13 `npx tsc --noEmit` + `npm run build` 通过

## 阶段 5：联调与验收（0.5d）

- [~] 5.1 启动前后端手测：后端已用新包在 8123 起，**前端浏览器交互未走**
- [~] 5.2 风险点验证：API 层面已验证软删后树中消失、同名拦截、改名不动正文；**向量 `is_vectorized` 保持 true 与对话页降级未实测**（无可用向量文档）
- [~] 5.3 边界：空库 / 超长目录名 / `/` 与控制字符 / 缺失目录 已验；50 文档与 5 层嵌套未压
- [x] 5.4 质量门：后端 `mvn package` 通过；前端 `npm run build` 通过
- [x] 5.5 收尾：冒烟数据与临时账号 `smoke_folder_p1` 已从开发库清理

## 阶段 6：文档同步（0.3d）

- [x] 6.1 `openspec/api-spec.md` 增补 §3.1.1「目录树」8 个接口 + 树响应结构
- [~] 6.2 `PROJECT_MEMORY.md` 同步（§3/§5/§6/§7.4/§10 待补）
- [~] 6.3 `frontend-style-guide.md` 补树行/右键菜单样式节（待补）

---

## 执行记录（2026-11-15）

**接口冒烟结果（`smoke-tree3.ps1`，账号 `smoke_folder_p1`，跑完即清理）**

| 用例 | 结果 |
|---|---|
| 建 A / B / A(子) | ✅ id 正常返回 |
| 根级同名、子级同名 | ✅ `40000 同级已存在同名目录` |
| 目录移入自身子目录（环） | ✅ `40000 不能移动到自身或其子目录` |
| 文档带 `folderId` 建档 | ✅ `tree.doc.folderId` 正确 |
| `stats(A)` | ✅ `docCount=1 folderCount=1` |
| 文档改名 | ✅ `code=0`；`markdownText` 首行仍是原 `# 测试文档`；`is_vectorized` 未被改动 |
| 超长标题 300 字 | ✅ `40000 标题不能超过 255 字` |
| 文档移 B / 移根 | ✅ `folderId=11` / 空 |
| 文档移到不存在目录 | ✅ `40400 目录不存在` |
| 目录改名 / 移入 B | ✅ `A1.parentId=11` |
| 非空目录非递归删 | ✅ `40000 目录非空…` |
| 递归删 | ✅ `code=0`，树中彻底消失 |
| 缺失目录 `stats` | ✅ `40400` |
| 中文关键词搜索 | ✅ `matched=1 docs=1 folders=1`（祖先目录保留） |

**踩坑（供后来者）**

1. PowerShell `"...folder/$id?recursive=true"` 会把 `$id?recursive` 整段当变量名，URL 变成 `/folder/=true` → 后端 `MethodArgumentTypeMismatchException`。必须用 `'...' + $id + '?recursive=true'` 拼接。
2. PG `simple` 分词不切中文，`plainto_tsquery('simple','检索引擎')` 与 `to_tsvector('simple','检索引擎笔记')` 整串 token 不同 → 命中 0。`selectTreeDocs` 已改为「title/summary `ILIKE` + 正文 `tsquery`」；`selectDocList`（旧 `/list` 接口）仍是纯 tsquery，未动。
3. `mvn package` 前必须先停占用 jar 的后端进程，否则 fat jar rename 失败并被替换成瘦包。
4. 环检测用例初次设计有误：先把 A1 移出 A 再测「A 移入 A1」，此时 A1 已不是 A 的后代，本就应该放行。正确做法是保留 A→A1 父子关系再测。
