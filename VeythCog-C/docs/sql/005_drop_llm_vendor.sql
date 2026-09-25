-- =============================================================
-- 005_drop_llm_vendor.sql · 供应商表下线（改后端枚举）
-- 背景：供应商为固定枚举（deepseek / dashscope），改由
--   com.vc.vcchat.llm.enums.LlmVendor 承载，不再建表。
-- 操作：先删 llm_model 上指向 llm_vendor 的外键，再删供应商表。
-- 适用于已按旧脚本（含 001_llm_vendor.sql）建过库的环境；
-- 全新部署直接按新脚本顺序（001_llm_model.sql / 002_app_user.sql / ...）即可。
-- =============================================================

-- 1) 若旧外键存在，先删除（MySQL 5.7 无 DROP FOREIGN KEY IF EXISTS，
--    执行前请确认 fk_llm_model_vendor 存在；全新部署无需跑本脚本）
ALTER TABLE llm_model DROP FOREIGN KEY fk_llm_model_vendor;

-- 2) 删除供应商表
DROP TABLE IF EXISTS llm_vendor;


-- =============================================================
-- ↓↓↓ PostgreSQL 版本（与上方 MySQL 脚本等价） ↓↓↓
-- 转换要点：
--   · MySQL: ALTER TABLE ... DROP FOREIGN KEY <约束名>;
--     PG:    ALTER TABLE ... DROP CONSTRAINT IF EXISTS <约束名>;
--     （PG 里外键与普通约束统一用 DROP CONSTRAINT 删除，
--       IF EXISTS 可避免约束不存在时报错，无需提前手工确认）
--   · DROP TABLE IF EXISTS 语法两者一致
-- =============================================================

-- 1) 若旧外键存在，先删除（全新部署无需跑本脚本）
ALTER TABLE llm_model DROP CONSTRAINT IF EXISTS fk_llm_model_vendor;

-- 2) 删除供应商表
DROP TABLE IF EXISTS llm_vendor;
