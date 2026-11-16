-- 024_clip.sql · 网页剪藏 + 收件箱 P2 建表脚本
-- 幂等设计：所有语句可重复执行（CREATE TABLE/INDEX IF NOT EXISTS）。
-- 全部为纯语句（不含 DO $$ 块），整文件执行或按 ';' 逐句执行（JDK ApplySql.java、GUI 客户端）结果一致。
-- 表由脚本管理（spring.jpa.hibernate.ddl-auto=none），不允许 Hibernate 自动建表。

-- 剪藏令牌：书签脚本运行在第三方域名，拿不到 localStorage 里的 JWT，用它做"只可写"的长期凭据。
-- 只存 SHA-256 摘要，明文仅在生成接口返回一次；撤销后旧书签立即失效。
CREATE TABLE IF NOT EXISTS clip_token (
    id           BIGSERIAL PRIMARY KEY,
    owner_id     BIGINT       NOT NULL,                          -- 归属账号（所有校验以此为准）
    token_hash   VARCHAR(64)  NOT NULL,                          -- SHA-256(token) 十六进制小写
    label        VARCHAR(100) NOT NULL DEFAULT '默认书签',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked      BOOLEAN      NOT NULL DEFAULT false
);

-- 同一令牌只允许有一条有效记录；撤销后同值可再次生成
CREATE UNIQUE INDEX IF NOT EXISTS uk_clip_token_hash
    ON clip_token (token_hash)
    WHERE revoked = false;

CREATE INDEX IF NOT EXISTS idx_clip_token_owner ON clip_token (owner_id, revoked);

-- 收件箱条目：剪藏进来的"待处理内容"，入库后回填 doc_id 指向 knowledge_doc
CREATE TABLE IF NOT EXISTS clip_item (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT        NOT NULL,
    url         VARCHAR(1000) NOT NULL DEFAULT '',               -- 原始链接（capture 可能为空）
    site        VARCHAR(200)  NOT NULL DEFAULT '',               -- 来源域名，列表展示用
    title       VARCHAR(300)  NOT NULL,
    byline      VARCHAR(200)  NOT NULL DEFAULT '',               -- 作者 / 站点名
    excerpt     VARCHAR(500)  NOT NULL DEFAULT '',               -- 正文前 200 字
    content_md  TEXT          NOT NULL DEFAULT '',               -- 清洗后的 Markdown（权威格式）
    raw_html    TEXT,                                            -- 原始 HTML，仅"查看原文"用，可清空
    word_count  INTEGER       NOT NULL DEFAULT 0,
    quality     VARCHAR(16)   NOT NULL DEFAULT 'ok',             -- ok/fallback（fallback=未提到正文，整页文本兜底）
    channel     VARCHAR(16)   NOT NULL DEFAULT 'url',            -- url/bookmarklet/extension/manual
    status      VARCHAR(16)   NOT NULL DEFAULT 'pending',        -- pending/archived/dropped
    error       VARCHAR(300)  NOT NULL DEFAULT '',               -- 抓取失败原因（非空即失败）
    tags        TEXT[]        NOT NULL DEFAULT '{}',
    doc_id      BIGINT,                                          -- 入库后的 knowledge_doc id
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted     BOOLEAN       NOT NULL DEFAULT false
);

-- 列表主查询路径：按账号 + 状态 + 时间倒序
CREATE INDEX IF NOT EXISTS idx_clip_item_owner ON clip_item (owner_id, deleted, status, created_at DESC);

-- URL 去重：同账号同链接视为同一条（表达式索引，配合 Service 内 select 判重）
CREATE INDEX IF NOT EXISTS idx_clip_item_url ON clip_item (owner_id, md5(url)) WHERE deleted = false;

-- 入库后与知识库文档的关联查询
CREATE INDEX IF NOT EXISTS idx_clip_item_doc ON clip_item (owner_id, doc_id) WHERE doc_id IS NOT NULL;
