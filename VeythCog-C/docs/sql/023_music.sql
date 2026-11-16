-- 023_music.sql · 音乐库模块 P0 建表脚本
-- 幂等设计：所有语句可重复执行（CREATE TABLE/INDEX IF NOT EXISTS）。
-- 全部为纯语句（不含 DO $$ 块），整文件执行或按 ';' 逐句执行（JDK ApplySql.java、GUI 客户端）结果一致。
-- 表由脚本管理（spring.jpa.hibernate.ddl-auto=none），不允许 Hibernate 自动建表。

CREATE TABLE IF NOT EXISTS music_track (
    id              BIGSERIAL PRIMARY KEY,
    owner_id        BIGINT       NOT NULL,                       -- 账号绑定：所有查询/写入都以该列为作用域
    title           VARCHAR(200) NOT NULL,
    artist          VARCHAR(200) NOT NULL DEFAULT '',
    duration_ms     INTEGER      NOT NULL DEFAULT 0,             -- 前端 <audio> 读取的时长（后端仅做上限校验）
    object_key      VARCHAR(500) NOT NULL,                       -- S3 music 桶内对象 key（不存 URL）
    cover_key       VARCHAR(500),                                -- 预留：封面对象 key（P1）
    cover_color     JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- 双色渐变 ["#7C3AED","#06B6D4"]
    source          VARCHAR(20)  NOT NULL DEFAULT 'UPLOAD',      -- UPLOAD/AI_GEN/JAMENDO/AIGEI_CC/AI_OTHER
    license         VARCHAR(20)  NOT NULL DEFAULT 'OWNED',       -- CC0/CC-BY/OWNED/AI_GEN/LICENSED（禁 CC-BY-NC）
    attribution     VARCHAR(500) NOT NULL DEFAULT '',            -- 署名文案（CC-BY 必填）
    license_url     VARCHAR(500) NOT NULL DEFAULT '',
    ai_disclosure   BOOLEAN      NOT NULL DEFAULT false,         -- AI 生成标识（显式 + 隐式）
    ai_model        VARCHAR(100) NOT NULL DEFAULT '',            -- 如 acestep-v15-turbo
    tags            TEXT[]       NOT NULL DEFAULT '{}',
    ambient_enabled BOOLEAN      NOT NULL DEFAULT false,         -- 是否进背景音池
    ambient_order   INTEGER      NOT NULL DEFAULT 0,
    status          VARCHAR(16)  NOT NULL DEFAULT 'published',   -- published/hidden
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted         BOOLEAN      NOT NULL DEFAULT false
);

-- 归属 + 逻辑删除索引：列表/详情/删除的主查询路径
CREATE INDEX IF NOT EXISTS idx_music_track_owner ON music_track (owner_id, deleted);

-- 背景音池查询（按人工排序取前 N 首）；部分索引避免把全量行都算进去
CREATE INDEX IF NOT EXISTS idx_music_track_ambient
    ON music_track (owner_id, ambient_enabled, ambient_order)
    WHERE deleted = false;

-- 关键词检索（标题 / 艺人）走 GIN 全文索引
CREATE INDEX IF NOT EXISTS idx_music_track_title_gin
    ON music_track USING gin (to_tsvector('simple', title || ' ' || artist));

-- 表注释（一次即可，重复执行会覆盖为同一内容）
COMMENT ON TABLE music_track IS '音乐曲库（账号绑定）：元信息 + S3 对象 key + 许可/AI 标识 + 背景音池';
COMMENT ON COLUMN music_track.owner_id IS '归属用户 id（账号隔离作用域，跨账号访问一律 40400）';
COMMENT ON COLUMN music_track.object_key IS 'S3 music 桶内对象 key；播放地址由接口按需生成短时签名';
COMMENT ON COLUMN music_track.cover_color IS '封面双色渐变，缺失时前端按标题 hash 兜底';
COMMENT ON COLUMN music_track.license IS '许可枚举 CC0/CC-BY/OWNED/AI_GEN/LICENSED，CC-BY-NC 不入库';
