-- =============================================================================
-- 026_todo_item.sql · 个人待办表
-- -----------------------------------------------------------------------------
-- 背景：系统此前没有「个人待办」载体（Admin/Tasks 是运维 mock，导航分类是收藏）。
--       首页「今日」视图需要展示待办并支持内联新增，故新建独立表。
-- 归属：待办是私人业务数据，带 user_id 按登录用户隔离（与知识库「全账号共享」
--       的历史决策不同，理由见 p1-unified-workbench/design.md §1.2）。
--       业务数据不进 user_setting（022 头注释：该表只存标量偏好）。
-- 幂等：CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS。
-- 顺序：在 025 之后执行。
-- =============================================================================

CREATE TABLE IF NOT EXISTS todo_item (
    id           BIGSERIAL     PRIMARY KEY,
    user_id      BIGINT        NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    title        VARCHAR(255)  NOT NULL,
    note         TEXT          NOT NULL DEFAULT '',
    status       VARCHAR(16)   NOT NULL DEFAULT 'open',   -- open / done（服务层白名单校验）
    priority     SMALLINT      NOT NULL DEFAULT 1,        -- 0 低 / 1 普通 / 2 高
    due_date     DATE          NULL,                      -- 截止日（只有日期，无时间）
    link_url     VARCHAR(1024) NULL,                      -- 外部链接（可选）
    link_doc_id  BIGINT        NULL,                      -- 关联知识库文档 id（弱引用，不建外键）
    sort_order   INT           NOT NULL DEFAULT 0,        -- 预留，v1 不启用
    completed_at TIMESTAMPTZ   NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted      BOOLEAN       NOT NULL DEFAULT false
);

COMMENT ON TABLE  todo_item IS '个人待办（用户级，软删除）';
COMMENT ON COLUMN todo_item.user_id      IS '所属用户；所有接口按 JWT 中的 userId 过滤';
COMMENT ON COLUMN todo_item.status       IS 'open / done；done 时写 completed_at，toggle 时清空';
COMMENT ON COLUMN todo_item.priority     IS '0 低 / 1 普通 / 2 高；列表排序参与';
COMMENT ON COLUMN todo_item.due_date     IS '截止日；NULL 表示无截止日，排序时置后';
COMMENT ON COLUMN todo_item.link_doc_id  IS '关联知识库文档 id；不建外键，文档删除后前端判空';
COMMENT ON COLUMN todo_item.sort_order   IS '预留手动排序字段，v1 不启用';
COMMENT ON COLUMN todo_item.completed_at IS '完成时间；未完成为 NULL';
COMMENT ON COLUMN todo_item.deleted      IS '软删除标记；查询一律过滤 deleted=true 的行';

CREATE INDEX IF NOT EXISTS idx_todo_user_status
    ON todo_item (user_id, status, deleted, due_date);
