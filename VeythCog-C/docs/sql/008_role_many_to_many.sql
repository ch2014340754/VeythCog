-- =============================================================
-- 008_role_many_to_many.sql · 角色多对多重构
-- 环境：PostgreSQL（Supabase）/ MySQL（本地开发）
-- 迁移要点：
--   · 新建 role 表 + user_role 关联表
--   · 把 app_user.role 列数据迁移到 user_role 关联表
--   · app_user.role 列保留（兼容回滚），新代码不再读写
-- =============================================================

-- ---------- role 表 ----------
CREATE TABLE IF NOT EXISTS role (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32) NOT NULL UNIQUE,
    name        VARCHAR(64) NOT NULL,
    description VARCHAR(256) DEFAULT '',
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  role IS '角色表';
COMMENT ON COLUMN role.code IS '角色标识: admin/user';
COMMENT ON COLUMN role.name IS '角色显示名';

INSERT INTO role (code, name, description) VALUES
    ('admin', '管理员', '系统管理员，拥有全部权限'),
    ('user',  '普通用户', '基础用户，可使用对话/知识库功能')
ON CONFLICT (code) DO NOTHING;

-- ---------- user_role 关联表 ----------
CREATE TABLE IF NOT EXISTS user_role (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    role_id BIGINT NOT NULL REFERENCES role(id),
    UNIQUE (user_id, role_id)
);

COMMENT ON TABLE user_role IS '用户-角色 多对多关联表';

-- ---------- 迁移旧数据：app_user.role → user_role ----------
INSERT INTO user_role (user_id, role_id)
SELECT u.id, r.id
FROM app_user u
JOIN role r ON r.code = u.role
WHERE NOT EXISTS (
    SELECT 1 FROM user_role ur WHERE ur.user_id = u.id AND ur.role_id = r.id
);
