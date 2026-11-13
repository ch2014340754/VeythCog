-- 020: 模型目录记录全部模态（不只一个 model_type）
-- modalities 使用逗号分隔的 ModelType code，例如 text,reasoning,vision
ALTER TABLE llm_model
    ADD COLUMN IF NOT EXISTS modalities VARCHAR(255);

COMMENT ON COLUMN llm_model.modalities IS '模型支持的模态，逗号分隔：text,reasoning,vision,omni,image,video,audio,embedding,other';

-- 现有数据回填：至少保留原有类型，避免页面出现空模态
UPDATE llm_model
SET modalities = model_type
WHERE modalities IS NULL OR btrim(modalities) = '';
