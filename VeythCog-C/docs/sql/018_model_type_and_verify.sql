-- 018: 模型类型 + 独立的单模型连通校验记录
-- 背景：校验不再要求先绑定；通过后可自由选择是否绑定。模型类型用于目录/选择页图标，
--       并决定校验走文本还是多模态 URL。
-- 执行要求：幂等，可重复执行。

-- 1. 模型目录：模型类型（text / reasoning / vision / omni / image / video / audio / embedding / other）
ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS model_type VARCHAR(32) NOT NULL DEFAULT 'text';

COMMENT ON COLUMN llm_model.model_type IS '模型类型：text 文本 / reasoning 推理 / vision 多模态理解 / omni 全模态 / image 图像生成 / video 视频生成 / audio 语音 / embedding 向量 / other 其他';

-- 2. 单模型校验记录：与绑定解耦，key_fingerprint 保证「校验用的 Key」与「实际对话用的 Key」一致
CREATE TABLE IF NOT EXISTS user_llm_model_verify (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    vendor_code VARCHAR(32) NOT NULL,
    model_code VARCHAR(64) NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT false,
    -- 校验时使用的 Key 指纹（SHA-256 前 8 位）；换 AK / 清 AK 后自动失效
    key_fingerprint VARCHAR(32),
    verify_error VARCHAR(300),
    last_verify_at TIMESTAMP WITH TIME ZONE,
    create_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    update_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_model_verify
    ON user_llm_model_verify (user_id, vendor_code, model_code);
CREATE INDEX IF NOT EXISTS idx_user_model_verify_user
    ON user_llm_model_verify (user_id, vendor_code);

COMMENT ON TABLE user_llm_model_verify IS '用户对单个模型的连通校验结论，不依赖是否已绑定';
COMMENT ON COLUMN user_llm_model_verify.key_fingerprint IS '校验时实际使用的 Key 指纹；与对话时有效 Key 不一致则校验结论作废';
