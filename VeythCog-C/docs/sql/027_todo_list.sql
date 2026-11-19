-- =============================================================================
-- 027_todo_list.sql · 待办列表（自定义分组）
-- -----------------------------------------------------------------------------
-- 背景：026 的 todo_item 只有一张平铺表，首页待办浮窗需要「今天 / 所有 / 自定义
--       列表」三级结构，参照 Things/TickTick 的分组形态。故新增 todo_list 表，
--       并在 todo_item 上挂 list_id 做归属。
-- 归属：用户级私有数据，按 user_id 隔离，与 todo_item 一致。
-- 弱引用：todo_item.list_id 不建外键 —— 列表是软删除，删列表时把待办解绑为
--       NULL（待办仍保留在「所有」里），与 link_doc_id 的处理方式保持一致。
-- 幂等：CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS。
-- 顺序：在 026 之后执行。
-- =============================================================================

CREATE TABLE IF NOT EXISTS todo_list (
    id         BIGSERIAL     PRIMARY KEY,
    user_id    BIGINT        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    name       VARCHAR(64)   NOT NULL,
    sort_order INT           NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted    BOOLEAN       NOT NULL DEFAULT false
);

COMMENT ON TABLE  todo_list IS '待办列表（用户自定义分组，软删除）';
COMMENT ON COLUMN todo_list.user_id    IS '所属用户；接口按 JWT 中的 userId 过滤';
COMMENT ON COLUMN todo_list.name       IS '列表名，1~64 字；同名允许（不做唯一约束，避免改名冲突打扰）';
COMMENT ON COLUMN todo_list.sort_order IS '新建时取同用户最大值 +10，保证默认排在末尾';
COMMENT ON COLUMN todo_list.deleted    IS '软删除标记；删列表时把其下待办的 list_id 解绑为 NULL';

CREATE INDEX IF NOT EXISTS idx_todo_list_user
    ON todo_list (user_id, deleted, sort_order);

-- 待办挂到列表：NULL = 未归类（仍出现在「所有」）
ALTER TABLE todo_item ADD COLUMN IF NOT EXISTS list_id BIGINT NULL;

COMMENT ON COLUMN todo_item.list_id IS '所属列表 id；弱引用不建外键，列表删除后解绑为 NULL';

CREATE INDEX IF NOT EXISTS idx_todo_item_list
    ON todo_item (user_id, list_id, deleted, status, due_date);
