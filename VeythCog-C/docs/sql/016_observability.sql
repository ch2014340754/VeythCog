-- =============================================================
-- 016_observability.sql · 系统监控（接口调用指标 / 会话 / LLM 用量）
-- 环境：PostgreSQL（vc 库）
-- 设计要点：
--   · 双写：sys_api_sample 留单请求明细（钻取、精确 P95），sys_api_metric_minute 留分钟桶（长期趋势/排行）
--   · 明细不存请求体与 query，只存归一化路由，避免把对话内容、搜索词写进监控库
--   · 业务错误看 biz_code（后端统一返回 HTTP 200 + 业务码），不能只看 HTTP status
--   · 会话表支撑「在线会话 + 强制下线」：JWT 携带 sid，踢人即把会话置 kicked
--   · 幂等：IF NOT EXISTS，可重复执行
-- =============================================================

-- 单请求明细（保留 30 天，由定时任务清理）
CREATE TABLE IF NOT EXISTS sys_api_sample (
    id          BIGSERIAL PRIMARY KEY,
    ts          TIMESTAMPTZ       NOT NULL DEFAULT now(),
    rid         VARCHAR(32),
    user_id     BIGINT,
    ip          VARCHAR(64),
    method      VARCHAR(10),
    route       VARCHAR(255),
    handler     VARCHAR(255),
    status      INTEGER,
    biz_code    INTEGER,
    cost_ms     INTEGER,
    stream      BOOLEAN           NOT NULL DEFAULT FALSE,
    error_msg   VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS idx_api_sample_ts ON sys_api_sample (ts);
CREATE INDEX IF NOT EXISTS idx_api_sample_route_ts ON sys_api_sample (route, ts);
CREATE INDEX IF NOT EXISTS idx_api_sample_biz_ts ON sys_api_sample (biz_code, ts);

COMMENT ON TABLE sys_api_sample IS '接口调用单请求明细（不含请求体与 query，隐私安全）';
COMMENT ON COLUMN sys_api_sample.route IS '归一化路由模板，如 /knowledge/doc/{docId}';
COMMENT ON COLUMN sys_api_sample.biz_code IS '业务返回码，0 表示成功；用于统计业务错误率';

-- 分钟聚合（保留 90 天）
CREATE TABLE IF NOT EXISTS sys_api_metric_minute (
    id          BIGSERIAL PRIMARY KEY,
    bucket      TIMESTAMPTZ       NOT NULL,
    method      VARCHAR(10)       NOT NULL,
    route       VARCHAR(255)      NOT NULL,
    calls       BIGINT            NOT NULL DEFAULT 0,
    errors      BIGINT            NOT NULL DEFAULT 0,
    sum_cost    BIGINT            NOT NULL DEFAULT 0,
    max_cost    INTEGER           NOT NULL DEFAULT 0,
    lt50        BIGINT            NOT NULL DEFAULT 0,
    lt100       BIGINT            NOT NULL DEFAULT 0,
    lt300       BIGINT            NOT NULL DEFAULT 0,
    lt1000      BIGINT            NOT NULL DEFAULT 0,
    lt3000      BIGINT            NOT NULL DEFAULT 0,
    ge3000      BIGINT            NOT NULL DEFAULT 0,
    CONSTRAINT uk_api_metric_minute UNIQUE (bucket, method, route)
);
CREATE INDEX IF NOT EXISTS idx_api_metric_bucket ON sys_api_metric_minute (bucket);

COMMENT ON TABLE sys_api_metric_minute IS '接口调用分钟聚合：计数 / 错误数 / 耗时直方图（用于长期趋势与 P95 估算）';

-- LLM 调用用量（保留 90 天）
CREATE TABLE IF NOT EXISTS llm_call_log (
    id                BIGSERIAL PRIMARY KEY,
    ts                TIMESTAMPTZ     NOT NULL DEFAULT now(),
    user_id           BIGINT,
    vendor            VARCHAR(32),
    model_code        VARCHAR(128),
    conversation_id   VARCHAR(128),
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    total_tokens      INTEGER,
    usage_source      VARCHAR(16),
    latency_ms        INTEGER,
    status            VARCHAR(16),
    error_code        VARCHAR(64),
    error_msg         VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS idx_llm_call_ts ON llm_call_log (ts);
CREATE INDEX IF NOT EXISTS idx_llm_call_model_ts ON llm_call_log (vendor, model_code, ts);

COMMENT ON TABLE llm_call_log IS 'LLM 调用记录：供应商返回的 usage 优先，缺失时按字符估算（usage_source=provider/estimated）';

-- 登录会话（支撑在线会话与强制下线）
CREATE TABLE IF NOT EXISTS sys_user_session (
    sid             VARCHAR(36) PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    username        VARCHAR(64),
    ip              VARCHAR(64),
    user_agent      VARCHAR(300),
    login_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    last_active_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    status          VARCHAR(16)     NOT NULL DEFAULT 'active',
    kicked_at       TIMESTAMPTZ,
    kicked_by       BIGINT
);
CREATE INDEX IF NOT EXISTS idx_user_session_active ON sys_user_session (status, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_session_user ON sys_user_session (user_id);

COMMENT ON TABLE sys_user_session IS '登录会话：JWT 携带 sid；status=active/kicked/logout/expired';
COMMENT ON COLUMN sys_user_session.status IS 'active 在线；kicked 管理员强制下线；logout 主动退出；expired 长期不活跃自动过期';
