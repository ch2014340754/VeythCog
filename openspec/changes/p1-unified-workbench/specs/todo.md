# Spec · 待办（todo_item）

> 变更：`p1-unified-workbench` / 2026-11-19
> 说明：本文件描述**行为与验收**，实现细节见 `../design.md` §1.2 / §2.2 / §3。

## 能力范围

用户可创建、编辑、完成、删除个人待办；待办按登录用户隔离；首页「今日」视图展示前 4 条未完成待办并支持内联新增。

## 行为契约

### B1 创建

- 请求：`POST /todo/items`，body `{ title, note?, priority?, dueDate?, linkUrl?, linkDocId? }`。
- `title` 去首尾空格后必须非空，长度 ≤ 255；否则 `40000`，错误信息指明原因。
- `priority` 缺省 `1`；只接受 `0/1/2`。
- `dueDate` 缺省 `null`；接受 `yyyy-MM-dd`，非法格式 `40000`。
- 成功返回新 `id`，`status=open`、`completed_at=null`、`created_at=now`。

### B2 列表

- `GET /todo/items?status=all|open|done&keyword=&current=1&pageSize=20`。
- `status` 缺省 `all`；`pageSize` 上限 100，超出按 100 处理。
- `keyword` 对 `title` 与 `note` 做 `ILIKE` 模糊匹配；空串等价于不过滤。
- 排序：`open` 组在前 → `due_date` 升序（NULL 最后）→ `priority` 降序 → `created_at` 降序；`done` 组按 `completed_at` 降序。
- 返回 `{ records, total, current, pageSize }`；无数据返回空数组 + `total=0`，不是错误。

### B3 局部更新

- `PUT /todo/items/{id}`，body 只含需要修改的字段（null/省略=不改）。
- **不接受 `status`**：改状态只能走 toggle，避免两套入口。
- `dueDate` 显式传 `null` 时清空（用 `clear` 数组语义不适用此处，直接允许 null 覆盖）。
- 目标不存在 / 不属于当前用户 / 已软删除 → `40400`。

### B4 切换完成

- `POST /todo/items/{id}/toggle`。
- `open → done`：写 `completed_at=now`；`done → open`：清空 `completed_at`。
- 返回切换后的完整 `TodoItemView`，前端可直接用返回值替换本地行，不必重拉列表。
- 幂等边界：连续两次 toggle 回到原状态（等价于"切换两次"），不是"设置完成"。

### B5 删除

- `DELETE /todo/items/{id}`：软删除（`deleted=true`），接口返回 `void`。
- 删除后：列表、overview 均不可见；再次 delete → `40400`。

### B6 归属与越权

- 所有接口以 JWT 中的 `userId` 过滤，**不信任前端传入的 user_id**（接口不提供该参数）。
- 查询他人 id 一律 `40400`，与"不存在"同码，不泄露存在性。

### B7 首页可见性

- `GET /workbench/overview` 的 `todos` 返回 `open` 状态前 4 条（按 B2 排序规则）。
- `stats.openTodos` = 全部 `open` 数量；`stats.todayDueTodos` = `due_date <= 今天` 的 `open` 数量。
- 待办为空时 `todos=[]`，前端渲染内联输入框空态。

## 验收标准

1. 新建后立即出现在 `/todo` 列表与首页「我的待办」；刷新后仍存在。
2. `title` 为空白/超长、`priority=3`、`dueDate=2026/11/20` 均返回 `40000` 且提示明确。
3. 勾选 → 划掉并写 `completed_at`；再勾 → 恢复且 `completed_at=null`。
4. 编辑截止日/优先级/备注/链接全部生效，列表排序随之变化（无截止日的排在后面）。
5. 软删除后两处列表都消失；SQL 复核 `deleted=true` 且行仍在。
6. 用另一个账号的 id 调 `PUT/toggle/delete` 一律 `40400`。
7. 关键词搜索「文档」「周报」命中标题与备注。
8. 分页：造 25 条数据，`pageSize=20` 第二页返回 5 条，`total=25`。

## 测试场景（apply 时手工过一遍）

| 场景 | 步骤 | 期望 |
|---|---|---|
| 空态新增 | 空列表输入标题回车 | 行出现、输入框清空、`openTodos+1` |
| 长标题 | 输入 300 字 | 前端截断到 255 前拦截并提示，或后端 `40000`（二者取其一，不得 500） |
| 截止日排序 | 建 A（明天）、B（无）、C（今天） | 顺序 C → A → B |
| 过期标记 | 建 D（昨天） | 行上显示红色日期/`overdue` 标记 |
| 双击 toggle | 快速点两次勾选 | 最终回到 open，`completed_at=null`，无重复行 |
| 删除竞态 | 列表删除后再点同一行 | 前端行已移除，不报错 |
| 断网重试 | 关闭后端后 toggle | 乐观更新回滚，提示"操作失败" |
