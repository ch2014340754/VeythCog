-- =============================================================================
-- 014_nav_itab_data.sql · 导航分类 / 书签数据入库（iTab 备份导入）
-- -----------------------------------------------------------------------------
-- 环境：PostgreSQL 15/16（与 012 / 013 同库）
-- 前置：app_user 表已存在。本脚本自带 schema 自愈：
--      线上只执行过 P0 版 012、没跑 013 也能直接跑完。
-- 目标用户：admin（线上用户名不同时，把脚本里所有 username = 'admin' 替换成实际用户名）
-- 内容：7 个分类 + 267 条书签（含 icon_type / icon_key / icon_text / icon_color）
-- 幂等：分类按 (user_id, name, deleted = false) 判重；
--       书签按 (user_id, category_id, url, deleted = false) 判重；
--       已存在的同 URL 书签只同步 4 个图标字段，不覆盖标题 / 分类 / 排序。
-- 前置资产：public-icons 桶里需已有对应 icon_key 对象；本脚本只写数据库引用，不上传图片。
--
-- 2026-11-12 修订（原版线上执行报错的根因，已在临时 PostgreSQL 实例复现并验证修复）：
--   ① 【致命】原版把源数据装进 CREATE TEMP TABLE nav_category / nav_bookmark，与真实表同名。
--      PostgreSQL 解析未限定表名时 pg_temp 优先于 search_path，于是后面
--      INSERT INTO nav_category (user_id, ...) 全部打到只有 4 列的临时表，报：
--        ERROR: column "user_id" of relation "nav_category" does not exist
--      → 临时表改名为 v_itab_category / v_itab_bookmark，彻底消除表名遮蔽。
--   ② 原版分类补齐写成 INSERT ... JOIN nav_category v ON TRUE，实为真实表自连接。
--      修掉 ① 的遮蔽后，会按"现有分类数量"重复插入；现有分类为 0 时则一条都不插。
--      → 改为 CROSS JOIN 临时清单 + NOT EXISTS 判重，每个分类最多一条。
--   ③ 线上若只执行过 P0 版 012、没跑 013，nav_bookmark 缺 5 个图标列，
--      原版会在写数据时报 column "icon_type" does not exist。
--      → 脚本内联 CREATE TABLE IF NOT EXISTS + ALTER ... ADD COLUMN IF NOT EXISTS，先自愈再写数据。
--   ④ 原版 admin 不存在时静默插入 0 行，看不出失败；
--      → 改为前置 RAISE EXCEPTION 明确报错，基础列缺失也给出可读提示。
--   ⑤ 图标同步 UPDATE 未排除软删除行 → 补 deleted = FALSE。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. schema 自愈：以代码实体（com.vc.nav.entity.*）和 012 最终版 DDL 为准
--    0.1 表不存在则建（已存在则跳过，不改动既有数据）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nav_category (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES app_user(id),
    name        VARCHAR(32)  NOT NULL,
    icon        VARCHAR(128) NOT NULL DEFAULT '',
    sort_order  INT          NOT NULL DEFAULT 0,
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nav_bookmark (
    id          BIGSERIAL PRIMARY KEY,
    category_id BIGINT       NOT NULL REFERENCES nav_category(id),
    user_id     BIGINT       NOT NULL REFERENCES app_user(id),
    title       VARCHAR(64)  NOT NULL,
    url         VARCHAR(512) NOT NULL,
    icon_type   VARCHAR(16)  NOT NULL DEFAULT 'auto',
    icon_key    VARCHAR(256) NULL,
    icon_text   VARCHAR(16)  NULL,
    icon_color  VARCHAR(16)  NULL,
    icon_synced_at TIMESTAMPTZ NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nav_setting (
    user_id              BIGINT       PRIMARY KEY REFERENCES app_user(id),
    search_engine        VARCHAR(16)  NOT NULL DEFAULT 'baidu',
    current_wallpaper_key VARCHAR(256) NULL,
    active_category_id   BIGINT       NULL,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 0.2 旧库补列：等价于 013_nav_bookmark_icon.sql（P0 库缺这 5 列）
ALTER TABLE nav_bookmark
    ADD COLUMN IF NOT EXISTS icon_type      VARCHAR(16) NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS icon_key       VARCHAR(256) NULL,
    ADD COLUMN IF NOT EXISTS icon_text      VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS icon_color     VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS icon_synced_at TIMESTAMPTZ NULL;

-- 0.3 icon_type 取值约束（与 NavBookmark.ICON_TYPE_* 常量一致）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_nav_bookmark_icon_type'
          AND conrelid = 'nav_bookmark'::regclass
    ) THEN
        ALTER TABLE nav_bookmark
            ADD CONSTRAINT ck_nav_bookmark_icon_type
            CHECK (icon_type IN ('auto', 'upload', 'text'));
    END IF;
END $$;

-- 0.4 基础列体检：缺列时直接给出可读提示，不让后面的 INSERT 报难懂的错
DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(t.c, ', ' ORDER BY t.c) INTO missing
    FROM (VALUES ('id'), ('category_id'), ('user_id'), ('title'), ('url'),
                 ('sort_order'), ('deleted'), ('created_at'), ('updated_at')) AS t(c)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = 'nav_bookmark'::regclass
          AND a.attname = t.c
          AND NOT a.attisdropped
    );
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'nav_bookmark 缺少基础列: %。请先执行 012_nav.sql 的完整建表语句', missing;
    END IF;
END $$;

-- 0.5 目标用户体检：不存在就报错，避免静默插入 0 行
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'admin') THEN
        RAISE EXCEPTION 'app_user 中找不到 username = ''admin'' 的用户，请把本脚本中的 admin 改成线上实际用户名';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. 源数据（临时表，命名加 v_ 前缀，避免与真实表 nav_* 重名）
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE v_itab_category (
    name VARCHAR(32), icon VARCHAR(128), sort_order INT, is_default BOOLEAN
) ON COMMIT DROP;

INSERT INTO v_itab_category (name, icon, sort_order, is_default) VALUES
    ('主页', '🏠', 10, TRUE),
    ('后端', '</>', 20, FALSE),
    ('前端', '🎨', 30, FALSE),
    ('学习', '📚', 40, FALSE),
    ('工具', '🛠', 50, FALSE),
    ('游戏', '🎮', 60, FALSE),
    ('AI', '✨', 70, FALSE)
;

CREATE TEMP TABLE v_itab_bookmark (
    category_name VARCHAR(32), title VARCHAR(64), url VARCHAR(512), sort_order INT,
    icon_type VARCHAR(16), icon_key VARCHAR(256), icon_text VARCHAR(16), icon_color VARCHAR(16)
) ON COMMIT DROP;

INSERT INTO v_itab_bookmark
    (category_name, title, url, sort_order, icon_type, icon_key, icon_text, icon_color)
VALUES
    ('主页', 'GitHub', 'https://github.com', 10, 'upload', 'icons/2026/11/12/f7191a64767940e6a939152958283697.png', NULL, NULL),
    ('主页', '掘金', 'https://juejin.cn', 20, 'upload', 'icons/2026/11/12/1996027d9e8f4d09b15bdd5603936a50.png', NULL, NULL),
    ('主页', '知乎', 'https://www.zhihu.com', 30, 'upload', 'icons/2026/11/12/883f0aec5d9042b49d26f9c4962ad164.png', NULL, NULL),
    ('主页', 'VeythCog', 'https://veythcog.top', 40, 'upload', 'icons/2026/11/12/9b1868e0f20a4aa286f6e2dad1a999ab.png', NULL, NULL),
    ('主页', '爱淘宝', 'https://taobao.coml.cc/', 50, 'upload', 'icons/2026/11/12/f43e849a9d0b4ee6a05240b8654cfdd9.png', NULL, NULL),
    ('主页', '京东商城', 'https://jd.coml.cc/', 60, 'upload', 'icons/2026/11/12/3c3c78c7499843f7ae311166d1400488.png', NULL, NULL),
    ('主页', '飞猪', 'https://www.fliggy.com/?spm=a219t.14254548.0.0.652e75a5QxVtbe', 70, 'upload', 'icons/2026/11/12/a0d41d7cf1074bb996d8c0ac67523c82.png', NULL, NULL),
    ('主页', '网易严选', 'http://you.163.com/?from=itab.link', 80, 'upload', 'icons/2026/11/12/7d25bfcd5e7d4ef3b7ec243d94a4d033.png', NULL, NULL),
    ('主页', '百度地图', 'http://map.baidu.com/', 90, 'upload', 'icons/2026/11/12/c88c4b3331f3475c84ccb51046aebf20.png', NULL, NULL),
    ('主页', 'IT之家', 'http://www.ithome.com/', 100, 'upload', 'icons/2026/11/12/e522ad580fa44d3a9a51dd5b9b7ec823.png', NULL, NULL),
    ('主页', '石墨', 'https://shimo.im/desktop', 110, 'upload', 'icons/2026/11/12/49302450789549b0abf160aeaf070559.png', NULL, NULL),
    ('主页', '爱奇艺', 'https://www.iqiyi.com/?vfm=f_432_dhm&fv=8648154ddd63e0af', 120, 'upload', 'icons/2026/11/12/77c1c145f5d54e2a8f5362633bc20a76.png', NULL, NULL),
    ('主页', '腾讯视频', 'https://v.qq.com/', 130, 'upload', 'icons/2026/11/12/539c503bfbf3499f98d029dc1d10f660.png', NULL, NULL),
    ('主页', '优酷', 'http://www.youku.com', 140, 'upload', 'icons/2026/11/12/089d7fbcdd974f019eea597ce536548f.png', NULL, NULL),
    ('主页', '一个工具箱', 'http://www.atoolbox.net/', 150, 'upload', 'icons/2026/11/12/440e87bb4ca64a3eb022177991e9ba22.png', NULL, NULL),
    ('主页', '菜鸟工具', 'https://c.runoob.com/', 160, 'upload', 'icons/2026/11/12/3c900f72cc884fd89cc481238f8ca380.png', NULL, NULL),
    ('主页', '新浪微博', 'http://weibo.com/', 170, 'upload', 'icons/2026/11/12/8d77d3fe67464f0fb4005a8f4ce17a11.png', NULL, NULL),
    ('主页', '网易云音乐', 'http://music.163.com/?from=itab', 180, 'upload', 'icons/2026/11/12/6122d06a132a40e5b72eb13314e881e9.png', NULL, NULL),
    ('主页', 'QQ音乐', 'http://y.qq.com/', 190, 'upload', 'icons/2026/11/12/2d03ba627f9640b8b99bc57a7b79f39a.png', NULL, NULL),
    ('主页', '哔哩哔哩 (゜-゜)つロ 干杯~-bil', 'http://www.bilibili.com/', 200, 'upload', 'icons/2026/11/12/fcca1655f1374a9abf6a0e8fd72ddb1c.png', NULL, NULL),
    ('主页', '12306', 'http://www.12306.cn', 210, 'upload', 'icons/2026/11/12/bc93c663fa994fa183313794f6e02cda.png', NULL, NULL),
    ('主页', 'iTab小组', 'https://support.qq.com/products/362782/#label=show', 220, 'upload', 'icons/2026/11/12/1a7fb49d3f87477fab7b936ec3e8a96c.png', NULL, NULL),
    ('主页', '编程导航', 'https://www.code-nav.cn/', 230, 'upload', 'icons/2026/11/12/51691aec538a4f3fb376d52efddfc529.png', NULL, NULL),
    ('主页', '阿里云', 'https://home.console.aliyun.com/home/dashboard/ProductAndService', 240, 'upload', 'icons/2026/11/12/93f7ddd6bed74bdb9b34f8d0082128cd.ico', NULL, NULL),
    ('主页', '哔哩哔哩', 'https://www.bilibili.com/', 250, 'upload', 'icons/2026/11/12/4e912b42412a4140b4cc6ee5ba3e4d57.png', NULL, NULL),
    ('主页', 'iCloud', 'https://www.icloud.com.cn/', 260, 'upload', 'icons/2026/11/12/6cf2cfe19acd4ba4969dc750d5de8490.png', NULL, NULL),
    ('主页', 'YouTube', 'https://www.youtube.com/', 270, 'upload', 'icons/2026/11/12/fef3ee58e7824ff988771a8f2486f9cc.png', NULL, NULL),
    ('主页', 'offer鸭 - 大学到职场的陪伴者', 'http://offer.loveyouway.top/bank', 280, 'upload', 'icons/2026/11/12/6e75aacd1de746128d0204d2e9217953.png', NULL, NULL),
    ('后端', 'Stack Overflow', 'https://stackoverflow.com', 10, 'upload', 'icons/2026/11/12/acf068c3e67a4e25bfe9f60b3a82e844.png', NULL, NULL),
    ('后端', 'Spring 官方', 'https://spring.io', 20, 'auto', 'icons/2026/11/12/bdfcebd0f6df49f184f5874cc8274b5d.png', NULL, NULL),
    ('后端', 'MyBatis-Plus', 'https://baomidou.com', 30, 'auto', NULL, NULL, NULL),
    ('后端', 'MDN', 'https://developer.mozilla.org/zh-CN/docs/Learn', 40, 'upload', 'icons/2026/11/12/733b7f5356404b7e8603e992683befe1.png', NULL, NULL),
    ('后端', 'V2EX', 'http://www.v2ex.com/', 50, 'upload', 'icons/2026/11/12/09e28911a9ae4eebbe7bb5f2448f312e.png', NULL, NULL),
    ('后端', '力扣', 'https://leetcode-cn.com/', 60, 'upload', 'icons/2026/11/12/7e366e178d4147659adfd05c571cd412.png', NULL, NULL),
    ('后端', 'React', 'https://zh-hans.reactjs.org/', 70, 'upload', 'icons/2026/11/12/3a81af5ec7d042bf909dcf705c11d2aa.png', NULL, NULL),
    ('后端', 'Java学习', 'https://mrjokersince1997.github.io/My-Notes/#/', 80, 'upload', 'icons/2026/11/12/84742003064d4bb3a7f05e4d62e71cf3.png', NULL, NULL),
    ('后端', 'Electron', 'https://electronjs.org/', 90, 'upload', 'icons/2026/11/12/3206b3b26f554b54a369351147e3cb5b.png', NULL, NULL),
    ('后端', 'CodePen', 'http://codepen.io', 100, 'upload', 'icons/2026/11/12/e6d71189bb614d57ab59f876a3018147.png', NULL, NULL),
    ('后端', 'ZUI', 'https://www.openzui.com/', 110, 'upload', 'icons/2026/11/12/93b178944a834ec0b12a09faa76eebb0.png', NULL, NULL),
    ('后端', 'TypeScript', 'https://typescript.bootcss.com/', 120, 'upload', 'icons/2026/11/12/153dddcf62b24af98ce99d4a4d2cdc7a.png', NULL, NULL),
    ('后端', '码云Gitee', 'https://gitee.com/', 130, 'upload', 'icons/2026/11/12/d38063331944431cab18bda62dea59f1.png', NULL, NULL),
    ('后端', 'CSDN', 'http://www.csdn.net/', 140, 'upload', 'icons/2026/11/12/921addddd1e24c71b47393fbedba2a7a.png', NULL, NULL),
    ('后端', 'w3school在线教程', 'http://www.w3school.com.cn', 150, 'upload', 'icons/2026/11/12/425918775c704efd81f4c84f370ac2cd.png', NULL, NULL),
    ('后端', '七牛云存储', 'https://s.qiniu.com/naaI7f', 160, 'upload', 'icons/2026/11/12/8c064013c4ff467d86474335a7c62891.png', NULL, NULL),
    ('后端', '开发者头条', 'http://toutiao.io', 170, 'upload', 'icons/2026/11/12/7e3d452b5cf843bea2962603c7af6568.png', NULL, NULL),
    ('后端', '开源中国', 'http://www.oschina.net/', 180, 'upload', 'icons/2026/11/12/34a82ea77fb14d2c9fb8ec95668f8bac.png', NULL, NULL),
    ('后端', 'uniapp', 'https://uniapp.dcloud.io/collocation/pages', 190, 'upload', 'icons/2026/11/12/abaff1f17d204adaa04cee4741aac973.png', NULL, NULL),
    ('后端', 'TechCrunch 中国 - 最新科技', 'http://techcrunch.cn/', 200, 'upload', 'icons/2026/11/12/f690c106f76542b18a5de780e9b2d5bd.png', NULL, NULL),
    ('后端', 'Git', 'https://git-scm.com/', 210, 'upload', 'icons/2026/11/12/fbd4ac70af8143f7a1720b6e5d456a07.png', NULL, NULL),
    ('后端', 'Ant Design Vue', 'https://www.antdv.com/docs/vue/introduce-cn/', 220, 'upload', 'icons/2026/11/12/dcd81b2f339d4c5c914abdedca9ce74f.png', NULL, NULL),
    ('后端', '谷歌翻译', 'https://translate.google.cn/', 230, 'upload', 'icons/2026/11/12/7225289086774dc194b66b39df487aef.png', NULL, NULL),
    ('后端', 'Flutter 中文官方', 'https://flutter.cn/', 240, 'upload', 'icons/2026/11/12/a130aebd2b5841718436a123759911e6.png', NULL, NULL),
    ('后端', 'DeepL翻译', 'https://www.deepl.com/zh/translator', 250, 'upload', 'icons/2026/11/12/25e421bbe3644f1b8d26ad15002d96ef.png', NULL, NULL),
    ('后端', '编程导航 - 程序员导航', 'https://home.code-nav.cn/', 260, 'upload', 'icons/2026/11/12/057983af520c4282a454a70e879062d0.png', NULL, NULL),
    ('后端', 'AI工具集', 'https://ai-bot.cn/?utm_source=itab', 270, 'upload', 'icons/2026/11/12/b452fb49543e4e4585ccf51380423a80.png', NULL, NULL),
    ('后端', '驾考宝典', 'http://www.jiakaobaodian.com/', 280, 'upload', 'icons/2026/11/12/2f63b9450e1c4623bfb4809e58dc1119.png', NULL, NULL),
    ('前端', 'MDN', 'https://developer.mozilla.org', 10, 'auto', 'icons/2026/11/12/8860abbfb3434abb88d7a92bc0f39344.png', NULL, NULL),
    ('前端', 'React 官方', 'https://react.dev', 20, 'auto', 'icons/2026/11/12/9d41d5087a264753b62982bb557e1332.png', NULL, NULL),
    ('前端', 'Can I Use', 'https://caniuse.com', 30, 'auto', 'icons/2026/11/12/e727d08ea78949c59dd4849f4c7c6e3a.png', NULL, NULL),
    ('前端', '面试鸭', 'https://www.mianshiya.com/', 40, 'upload', 'icons/2026/11/12/76532ee7ffcd42298440eedae7570fd1.png', NULL, NULL),
    ('前端', '绘画艺术', 'http://www.qijishow.com/Brand/Brand23/index.htm', 50, 'upload', 'icons/2026/11/12/65f99730b17347be93b02ba9fb696cb0.png', NULL, NULL),
    ('前端', '1X', 'https://1x.com/', 60, 'upload', 'icons/2026/11/12/5a6f9315a1af4a4595688af82df60771.png', NULL, NULL),
    ('前端', '天空之城 | 全球航拍爱好者和专业摄影师', 'https://www.skypixel.com/', 70, 'upload', 'icons/2026/11/12/12add4f10249477a9d9f01c10181050e.png', NULL, NULL),
    ('前端', 'GIPHY', 'http://giphy.com/?status=200#_=_', 80, 'upload', 'icons/2026/11/12/9a12124646e24c4080ffbc084a80b46d.png', NULL, NULL),
    ('前端', 'Adobe Color', 'https://color.adobe.com/zh/create/color-wheel/', 90, 'upload', 'icons/2026/11/12/7a287ad6a12a477792e39d55f3cf2f8c.png', NULL, NULL),
    ('前端', 'R站', 'https://www.btbat.com/', 100, 'upload', 'icons/2026/11/12/af97c0c18f5e4b6e9cb544511d844eee.png', NULL, NULL),
    ('前端', '站酷', 'http://www.zcool.com.cn', 110, 'upload', 'icons/2026/11/12/9fd72a40ce984aeda22ae856f655031f.png', NULL, NULL),
    ('前端', 'Canvas', 'https://www.canva.com', 120, 'upload', 'icons/2026/11/12/ffa1a672a03e4982a7548a582defc954.png', NULL, NULL),
    ('前端', '网易见外工作台', 'https://jianwai.youdao.com/index/1', 130, 'upload', 'icons/2026/11/12/8c8853a92ff342849fb3300ea71472be.png', NULL, NULL),
    ('前端', '昵图网', 'http://www.nipic.com/index.html', 140, 'upload', 'icons/2026/11/12/53db884c947e41b1b8e368fa92c7bb6c.png', NULL, NULL),
    ('前端', '每日 ui 设计', 'https://uidesigndaily.com/', 150, 'upload', 'icons/2026/11/12/46a530a4eafb4447979c30a21ec83354.png', NULL, NULL),
    ('前端', '花瓣', 'http://huaban.com/', 160, 'upload', 'icons/2026/11/12/fd0a24499a6643e1b744897e0e56f8bf.png', NULL, NULL),
    ('前端', 'Dribbble', 'https://dribbble.com', 170, 'upload', 'icons/2026/11/12/fdc9d0fc68a844e58dfa8276cfd8176e.png', NULL, NULL),
    ('前端', 'Unsplash', 'https://unsplash.com/', 180, 'upload', 'icons/2026/11/12/1f253ae23bbc42daa064c1eb1f2e655a.png', NULL, NULL),
    ('前端', '大作免费版权图片设计导航网站|全球唯一直', 'https://www.bigbigwork.com', 190, 'upload', 'icons/2026/11/12/787e73cfaf024cc7bd17770fe3696486.png', NULL, NULL),
    ('前端', 'TinyPNG', 'https://tinypng.com', 200, 'upload', 'icons/2026/11/12/d8880d9dda134588a3ec1152f5274072.png', NULL, NULL),
    ('前端', '搜图导航', 'https://www.91sotu.com/', 210, 'upload', 'icons/2026/11/12/eff2a6c3c5304e5bbf74a839a35eebd3.png', NULL, NULL),
    ('前端', '渐变配色', 'https://webgradients.com/', 220, 'upload', 'icons/2026/11/12/6ca236e215d94beb8c101c6585b1b793.png', NULL, NULL),
    ('前端', '90设计网，电商设计模板 PNG素材 背', 'http://90sheji.com/', 230, 'upload', 'icons/2026/11/12/f3c9aed6314f46469903d26755b0731b.png', NULL, NULL),
    ('前端', 'Iconfont-矢量图标库', 'https://www.iconfont.cn/', 240, 'upload', 'icons/2026/11/12/a2e89811e5934a8aba732b16ff8eb31b.png', NULL, NULL),
    ('前端', 'Adobe Color CC', 'https://color.adobe.com/zh/explore/newest/', 250, 'upload', 'icons/2026/11/12/36fb13f02c8342f8b5200f67733cd15a.png', NULL, NULL),
    ('前端', 'Vue2', 'https://cn.vuejs.org/', 260, 'upload', 'icons/2026/11/12/480e816bd6554b15bfd9102e30b2937d.png', NULL, NULL),
    ('前端', 'API', 'https://cn.vuejs.org/v2/api/', 270, 'upload', 'icons/2026/11/12/d0beb5d0022a4019865946e3341d5c73.png', NULL, NULL),
    ('前端', 'Bootstrap', 'https://www.bootcss.com/', 280, 'upload', 'icons/2026/11/12/18fc5ad52e1445acb5b59ee62c097993.png', NULL, NULL),
    ('前端', '设宝导航', 'https://hao.sheboo.com/', 290, 'upload', 'icons/2026/11/12/c1bde2350caa48fe9557364c8a88eeaa.png', NULL, NULL),
    ('前端', 'UI酷设计', 'http://uicool123.com/member', 300, 'upload', 'icons/2026/11/12/50436351af7448a6a6fecc7195f3b268.png', NULL, NULL),
    ('前端', 'Free stock photos ·', 'https://www.pexels.com/', 310, 'upload', 'icons/2026/11/12/b28461cb771348feacc7376b5f4c5044.png', NULL, NULL),
    ('前端', 'Pixabay', 'https://pixabay.com/', 320, 'upload', 'icons/2026/11/12/673bf41f708b496d9addf241a1e61ed1.png', NULL, NULL),
    ('前端', '千图网', 'http://www.58pic.com/', 330, 'upload', 'icons/2026/11/12/bccdd1116eee49f8b0522662c43c7af9.png', NULL, NULL),
    ('前端', '无版权图', 'https://colorhub.me', 340, 'upload', 'icons/2026/11/12/68baa7f8b8d6404f8cb764b8f816d16e.png', NULL, NULL),
    ('前端', '优设-UISDC: 优秀网页设', 'http://www.uisdc.com/', 350, 'upload', 'icons/2026/11/12/040c7b3f0335401c8067fad6f6dbacdb.png', NULL, NULL),
    ('前端', 'UI中国', 'http://www.ui.cn', 360, 'upload', 'icons/2026/11/12/11db6234eec344ddb3d85b1851b2ef4c.png', NULL, NULL),
    ('前端', '包图网', 'http://ibaotu.com/', 370, 'upload', 'icons/2026/11/12/2ef710e52cec46ae813f1a6eb3eefcd8.png', NULL, NULL),
    ('前端', 'Freepik', 'http://freepik.com', 380, 'upload', 'icons/2026/11/12/01462cfb975b494eb53ea3bc5c0734ab.png', NULL, NULL),
    ('前端', '稿定设计', 'https://www.gaoding.com/utms/cd52981c7dfe966f01ee33d63fa94183', 390, 'upload', 'icons/2026/11/12/933bb212fb784caa8397a38a2fa9ee31.png', NULL, NULL),
    ('前端', '摄图网', 'http://699pic.com/best.html', 400, 'upload', 'icons/2026/11/12/3b44d925215246c0aee8c795517e5c43.png', NULL, NULL),
    ('前端', '致设计', 'http://www.zhisheji.com/', 410, 'upload', 'icons/2026/11/12/b7f53093c036412c81a5e3c0664a4590.png', NULL, NULL),
    ('前端', '奇迹秀设计工具箱', 'http://www.qijishow.com/down/index.html', 420, 'upload', 'icons/2026/11/12/481492eb5d484abeb673dc0b77e6b0ca.png', NULL, NULL),
    ('前端', '中国色', 'http://zhongguose.com/', 430, 'upload', 'icons/2026/11/12/fd61fd0547fe49298aa75847991a2489.png', NULL, NULL),
    ('前端', 'Fotor', 'http://www.fotor.com/cn/', 440, 'upload', 'icons/2026/11/12/844b7b0bb28d47be8580bcce4e2df8b6.png', NULL, NULL),
    ('前端', '蜂鸟网', 'http://www.fengniao.com/', 450, 'upload', 'icons/2026/11/12/4e296376b77548e8b57dbb8c45a686fa.png', NULL, NULL),
    ('前端', '网页配色', 'http://tool.c7sky.com/webcolor/', 460, 'upload', 'icons/2026/11/12/31be253100b04443bed99fd729d536f0.png', NULL, NULL),
    ('前端', 'Material UI Colors', 'http://materialuicolors.co/', 470, 'upload', 'icons/2026/11/12/acb5bfdd7a114d4ea97f459b456ee08b.png', NULL, NULL),
    ('前端', 'ES6 入门教程', 'https://es6.ruanyifeng.com/', 480, 'upload', 'icons/2026/11/12/d9a83b44652c439eb77f3ba656f16dbf.png', NULL, NULL),
    ('前端', '图标库 – Font Awesome 中', 'http://www.fontawesome.com.cn/faicons/', 490, 'text', NULL, '图标库', '#50DE0B'),
    ('前端', 'Element - The world''', 'https://element.eleme.cn/#/zh-CN/component/installation', 500, 'upload', 'icons/2026/11/12/dd4cb9cfddd04d34ac7f98b6d829dc0f.png', NULL, NULL),
    ('前端', 'Lorem Picsum（图片用例）', 'https://picsum.photos/', 510, 'upload', 'icons/2026/11/12/cbd7f37e8b8d49c791f1958e6cbd04b6.png', NULL, NULL),
    ('前端', 'jQuery插件库', 'https://www.jq22.com/', 520, 'upload', 'icons/2026/11/12/4675e9ad8def4e30a8b4fbd1347bbf0b.png', NULL, NULL),
    ('前端', 'BootCDN - Bootstrap', 'https://www.bootcdn.cn/', 530, 'upload', 'icons/2026/11/12/04ddd1cc1ec54388918714a299834e58.png', NULL, NULL),
    ('前端', 'MDN', 'https://developer.mozilla.org/zh-CN/', 540, 'upload', 'icons/2026/11/12/48ca30dec7ef40f2919f17c9791ef863.png', NULL, NULL),
    ('前端', 'React中文网', 'https://docschina.org/', 550, 'upload', 'icons/2026/11/12/d58b1bbe63bf4dfc96608bde2c697340.png', NULL, NULL),
    ('前端', 'npm', 'https://www.npmjs.com/', 560, 'upload', 'icons/2026/11/12/1c7b76d1161d410ca8d6d270a656193f.png', NULL, NULL),
    ('前端', '一个 Vue 3 UI 框架 | Ele', 'https://element-plus.org/zh-CN/', 570, 'upload', 'icons/2026/11/12/33009466b2c84d749274b340e24506b7.png', NULL, NULL),
    ('前端', 'xm-select', 'https://ruanlinxin.github.io/code-demo/#/basic/on', 580, 'text', NULL, 'xm-', '#A3DDB9'),
    ('前端', 'PNG素材网-免费高清透明PNG素材', 'https://www.pngsucai.com/', 590, 'upload', 'icons/2026/11/12/d95ae82bbdc44890b219d73d18c961fc.png', NULL, NULL),
    ('前端', 'HTML5 UP! Respon', 'https://html5up.net/', 600, 'upload', 'icons/2026/11/12/6fa0490255d3465e924ae48df69d8c15.png', NULL, NULL),
    ('学习', '力扣', 'https://leetcode.cn', 10, 'upload', 'icons/2026/11/12/b252f35f29f1453798dea003f9b170b6.png', NULL, NULL),
    ('学习', 'SegmentFault', 'https://segmentfault.com', 20, 'upload', 'icons/2026/11/12/ffa2db5060f34c91937e76c874e076dc.png', NULL, NULL),
    ('学习', '墨刀', 'https://modao.cc/workspace/apps', 30, 'upload', 'icons/2026/11/12/ca6b410889be4a0c8715944929c9a5f3.png', NULL, NULL),
    ('学习', '人人都是产品经理', 'http://www.woshipm.com/', 40, 'upload', 'icons/2026/11/12/e801319b6bc04f0595196137943e249f.png', NULL, NULL),
    ('学习', 'Notion', 'https://www.notion.so/e206adfe7e474ef1b9a1c0c436ba048c?v=559b030d207f4b28bc8470a7c33b65c0', 50, 'upload', 'icons/2026/11/12/b50c017fcb7f4c608d788f7f1ec1ac84.png', NULL, NULL),
    ('学习', '蓝湖', 'https://lanhuapp.com', 60, 'upload', 'icons/2026/11/12/f1b930a05c7245b58f5d403ab749602f.png', NULL, NULL),
    ('学习', 'AppAnnie', 'https://www.appannie.com/cn/', 70, 'upload', 'icons/2026/11/12/20c39a9506444d439c7c8f854246a69a.png', NULL, NULL),
    ('学习', 'Teambition', 'https://www.teambition.com/projects', 80, 'upload', 'icons/2026/11/12/31dc19cb1ee748a5af162454697ee030.png', NULL, NULL),
    ('学习', '七麦数据', 'https://www.qimai.cn/', 90, 'upload', 'icons/2026/11/12/578ff145d4814803885d52a3bfc9d0cd.png', NULL, NULL),
    ('学习', '滴答清单', 'https://www.dida365.com/', 100, 'upload', 'icons/2026/11/12/4b392a17b7424306be139d8c02fabc3e.png', NULL, NULL),
    ('学习', '36氪', 'http://www.36kr.com', 110, 'upload', 'icons/2026/11/12/82c28f7e70ed4d1d9ec03ac85094294e.png', NULL, NULL),
    ('学习', 'Medium', 'https://medium.com/', 120, 'upload', 'icons/2026/11/12/ec30eb6426934e78a61bd8804862c5d4.png', NULL, NULL),
    ('学习', 'ProcessOn', 'https://www.processon.com/?utm_source=itab', 130, 'upload', 'icons/2026/11/12/e1b38b2c415f454aa179948e304a38ff.png', NULL, NULL),
    ('学习', 'Quora', 'https://www.quora.com/#', 140, 'upload', 'icons/2026/11/12/74a2abb7b475409fb4ecf0b02dba045d.png', NULL, NULL),
    ('学习', 'PMCAFF', 'http://www.pmcaff.com/', 150, 'upload', 'icons/2026/11/12/828158d6b12545f687efc3b7848fb9cd.png', NULL, NULL),
    ('学习', 'BoardOS', 'https://boardos.online?from=itab.link', 160, 'upload', 'icons/2026/11/12/3061a9a3cc134352a1825387764be7ec.png', NULL, NULL),
    ('学习', 'Bookzz - Bookzz.org', 'https://www.bookzz.ren/', 170, 'text', NULL, 'Boo', '#F01313'),
    ('学习', '语雀', 'https://www.yuque.com/dashboard', 180, 'upload', 'icons/2026/11/12/365f12a316ea45cbbc6d436b022b458a.png', NULL, NULL),
    ('学习', '尚硅谷Vue2.0+Vue3.0全套教程', 'https://www.bilibili.com/video/BV1Zy4y1K7SH?spm_id_from=333.1007.top_right_bar_window_custom_collection.content.click', 190, 'upload', 'icons/2026/11/12/dbe33a8b6bbe4ad5950b42f20c106d97.png', NULL, NULL),
    ('学习', '尚硅谷VUE项目实战，前端项目-尚品汇(', 'https://www.bilibili.com/video/BV1Vf4y1T7bw?p=23', 200, 'upload', 'icons/2026/11/12/3574ddf1d73947e4bfdc27de24c2d145.png', NULL, NULL),
    ('学习', '【黑马程序员】前端开发之Vue项目实战_', 'https://www.bilibili.com/video/BV1x64y1S7S7?p=38&spm_id_from=333.880.my_history.page.click', 210, 'upload', 'icons/2026/11/12/8744a086a16c4f6ebbec28778b18cd06.png', NULL, NULL),
    ('学习', '【编程不良人】适合后端编程人员的 Ele', 'https://www.bilibili.com/video/BV1NK4y187XH?p=1&vd_source=e828c5b539fa1d2949d52e64fdfeac70', 220, 'text', NULL, '【编程', '#276CE6'),
    ('学习', '电商平台数据可视化实时监控系统-Echa', 'https://www.bilibili.com/video/BV1bh41197p8?p=2&vd_source=e828c5b539fa1d2949d52e64fdfeac70', 230, 'text', NULL, '电商平', '#2ECC71'),
    ('学习', '课程指南 | Vue3+TS 快速上手', 'https://24kcs.github.io/vue3_study/00_%E8%AF%BE%E7%A8%8B%E4%BB%8B%E7%BB%8D.html', 240, 'upload', 'icons/2026/11/12/0f5e85bbce3740f7afecff12bb6230f6.jpg', NULL, NULL),
    ('学习', 'Documentation - Apac', 'https://echarts.apache.org/zh/option.html#title', 250, 'upload', 'icons/2026/11/12/c3a427f0d02c46fba5a0dfeb0ca9bbee.png', NULL, NULL),
    ('学习', '5. 什么是线程安全，造成线程安全的本质', 'https://www.bilibili.com/video/BV1K54y1g75B/?p=5&spm_id_from=pageDriver&vd_source=e828c5b539fa1d2949d52e64fdfeac70', 260, 'upload', 'icons/2026/11/12/a8f1c77b45d64267bb9c5a7b9dbbd261.png', NULL, NULL),
    ('学习', '44. Spring中的Bean创建的生', 'https://www.bilibili.com/video/BV1eD4y1w7Rp?p=54&vd_source=e828c5b539fa1d2949d52e64fdfeac70', 270, 'upload', 'icons/2026/11/12/6ae6ea26a0b849df98971880506776e9.png', NULL, NULL),
    ('学习', '76. Redis单线程为什么这么快_哔', 'https://www.bilibili.com/video/BV1eD4y1w7Rp?p=85&vd_source=e828c5b539fa1d2949d52e64fdfeac70', 280, 'upload', 'icons/2026/11/12/9ee4495b907f468684114b3a0aafeefd.png', NULL, NULL),
    ('学习', '【并发编程】什么是CAS？有什么优缺点？', 'https://www.bilibili.com/video/BV14s4y1P7nu/?p=2&spm_id_from=pageDriver&vd_source=e828c5b539fa1d2949d52e64fdfeac70', 290, 'upload', 'icons/2026/11/12/7756b6d20762434492a23ff9f3d74671.png', NULL, NULL),
    ('学习', '互联网 Java 工程师进阶知识完全', 'https://doocs.gitee.io/advanced-java/#/?id=%e4%ba%92%e8%81%94%e7%bd%91-java-%e5%b7%a5%e7%a8%8b%e5%b8%88%e8%bf%9b%e9%98%b6%e7%9f%a5%e8%af%86%e5%ae%8c%e5%85%a8%e6', 300, 'upload', 'icons/2026/11/12/7890be94f0e54d2d973ff9fe6ff66e4b.png', NULL, NULL),
    ('学习', 'docker | Docker Do', 'https://docs.docker.com/reference/cli/docker/', 310, 'upload', 'icons/2026/11/12/0f7eb4fa771f45f5a40294b7940e1be2.png', NULL, NULL),
    ('学习', '技术文章摘抄', 'https://learn.lianglianglee.com/', 320, 'upload', 'icons/2026/11/12/cfb8265a854b4b51b3db61dd945628b7.png', NULL, NULL),
    ('工具', 'Google 翻译', 'https://translate.google.com', 10, 'auto', NULL, NULL, NULL),
    ('工具', 'DeepL', 'https://www.deepl.com', 20, 'auto', 'icons/2026/11/12/4e672bec3f51445a98ee9ce53a152266.ico', NULL, NULL),
    ('工具', '新浪微博', 'https://weibo.com/', 30, 'upload', 'icons/2026/11/12/5cf8bd4c7e0546799e37ed976cfdd73f.png', NULL, NULL),
    ('工具', '腾讯视频', 'http://v.qq.com/', 40, 'upload', 'icons/2026/11/12/24729bc56c41456180f2672a8996a092.png', NULL, NULL),
    ('工具', 'Steam', 'https://steamcommunity.com/', 50, 'upload', 'icons/2026/11/12/77289eed91414d08b3463b964b916069.png', NULL, NULL),
    ('工具', '抖音', 'https://www.douyin.com/?ug_source=pc_liangxiang_01', 60, 'upload', 'icons/2026/11/12/d5e470b0a0064299832c18e10c740c47.png', NULL, NULL),
    ('工具', '即刻网页版', 'https://web.okjike.com', 70, 'upload', 'icons/2026/11/12/9b49198a7d784292b3e244b1cfe8da57.png', NULL, NULL),
    ('工具', '小霸王', 'https://www.yikm.net/', 80, 'upload', 'icons/2026/11/12/4450559576fc40e1b90ab2a8dec6b23c.png', NULL, NULL),
    ('工具', '斗鱼', 'http://www.douyutv.com/', 90, 'upload', 'icons/2026/11/12/713e1703836d496891ab3271cc129950.png', NULL, NULL),
    ('工具', '番组放送', 'https://bgmlist.com/', 100, 'upload', 'icons/2026/11/12/a991e00cc6904670868bfea0f3bdc305.png', NULL, NULL),
    ('工具', '摸鱼', 'http://mo.fish', 110, 'upload', 'icons/2026/11/12/405d402287274832932633d2eb16b174.png', NULL, NULL),
    ('工具', '铅笔小说', 'https://www.x23qb.com/', 120, 'upload', 'icons/2026/11/12/fede940644724a468c4ae4d339af9ed7.png', NULL, NULL),
    ('工具', '半次元-第一中文COS绘画小说社区', 'https://bcy.net', 130, 'upload', 'icons/2026/11/12/5e145aa00fb24cf28b9c85e24aac0bda.png', NULL, NULL),
    ('工具', '塔读文学小说网-好看的畅销小说,原创小', 'http://www.tadu.com/', 140, 'upload', 'icons/2026/11/12/29ebc8094a6a4ff8957b832c8f846da3.png', NULL, NULL),
    ('工具', '煎蛋', 'http://jandan.net/', 150, 'upload', 'icons/2026/11/12/15837f1aa5514a2fa7fcc4d8036055fc.png', NULL, NULL),
    ('工具', '豆瓣', 'http://www.douban.com', 160, 'upload', 'icons/2026/11/12/b91c146922134c94aceaa05616d76a9a.png', NULL, NULL),
    ('工具', '腾讯动漫', 'https://ac.qq.com/', 170, 'upload', 'icons/2026/11/12/13067493e1ac465a87943c92fffdb81a.png', NULL, NULL),
    ('工具', '划水摸鱼', 'http://www.huashuimoyu.com', 180, 'upload', 'icons/2026/11/12/a6a0fb4e762541c1964e1e48a51c6467.png', NULL, NULL),
    ('工具', '抽屉新热榜', 'http://dig.chouti.com/', 190, 'upload', 'icons/2026/11/12/2a5b9031c8ea44bb8c3f10b6c2677690.png', NULL, NULL),
    ('工具', '猫扑', 'http://www.mop.com/', 200, 'upload', 'icons/2026/11/12/1df22cb0db5d4c718150db895330e82d.png', NULL, NULL),
    ('工具', '起点小说排行榜', 'https://www.qidian.com/rank', 210, 'upload', 'icons/2026/11/12/8c65be28babc47528990010d901bf940.png', NULL, NULL),
    ('工具', '动漫之家', 'https://manhua.dmzj.com/', 220, 'upload', 'icons/2026/11/12/5ac31eb5eccf47109bd723417910b327.png', NULL, NULL),
    ('工具', '文叔叔', 'https://www.wenshushu.cn/', 230, 'upload', 'icons/2026/11/12/89c77b32381d4cee988f9ecb2a6f4128.png', NULL, NULL),
    ('工具', '奶牛快传', 'https://www.gaoding.com/utms/9cc0e70b71bd42f3a8253e059433a48c', 240, 'upload', 'icons/2026/11/12/b12148f2523246ce888bbf8158797ea0.png', NULL, NULL),
    ('工具', 'OfficePLUS', 'https://www.officeplus.cn/?sid=itab&endpoint=OPPC&source=OPCNitab', 250, 'text', NULL, 'Off', '#EE3B3B'),
    ('工具', 'Wallhaven', 'https://wallhaven.cc/', 260, 'upload', 'icons/2026/11/12/ea3d338a77d64acf89054896b1649ea2.png', NULL, NULL),
    ('工具', '音乐搜索器 - 多站合一音乐搜索,音乐在', 'http://www.xmsj.org/', 270, 'text', NULL, '音乐搜', '#9326E9'),
    ('工具', 'httpbin.org', 'http://httpbin.org/', 280, 'upload', 'icons/2026/11/12/5cfe9be5e7a249f3a0f70c8714f55f3b.png', NULL, NULL),
    ('工具', '极简壁纸_海量电脑桌面壁纸美图_4K超高', 'https://bz.zzzmh.cn/index', 290, 'upload', 'icons/2026/11/12/2f4a9527fd134fddacae6c578e426cd4.png', NULL, NULL),
    ('工具', 'Versus | 万物皆可对比', 'https://versus.com/cn', 300, 'text', NULL, 'Ver', '#4B3C36'),
    ('工具', '百度图片-发现多彩世界', 'https://image.baidu.com/', 310, 'upload', 'icons/2026/11/12/3a683828e4234db0add0f8e295384a69.png', NULL, NULL),
    ('工具', 'XML工具', 'https://www.sojson.com/xml.html', 320, 'upload', 'icons/2026/11/12/80956847882a4384a1d8dfbf4d8433a6.png', NULL, NULL),
    ('工具', 'JSON在线', 'https://www.sojson.com/', 330, 'upload', 'icons/2026/11/12/80956847882a4384a1d8dfbf4d8433a6.png', NULL, NULL),
    ('工具', '致美化 - 漫锋网', 'https://zhutix.com/', 340, 'upload', 'icons/2026/11/12/0c18d4a6077843afa50b64b2d83a2352.png', NULL, NULL),
    ('工具', '前端代码美化', 'https://beautifier.io/', 350, 'upload', 'icons/2026/11/12/03c1cb9a9a48460fbdeef27956ddb7ed.png', NULL, NULL),
    ('工具', '四川省, 成都市, 武侯区 降水地图', 'https://www.msn.cn/zh-cn/weather/maps/precipitation/in-%E5%9B%9B%E5%B7%9D%E7%9C%81,%E6%88%90%E9%83%BD%E5%B8%82?weadegreetype=C&ocid=widgetonlockscreen&cvid=67f0', 360, 'upload', 'icons/2026/11/12/204d0c9218d246dbb88d06501ac1639c.png', NULL, NULL),
    ('工具', '马可菠萝 - 分享你喜欢的MAC应用', 'https://www.macbl.com/', 370, 'upload', 'icons/2026/11/12/e0ec482058374856828d358b6bd23484.png', NULL, NULL),
    ('工具', '精品MAC应用分享', 'https://xclient.info/', 380, 'upload', 'icons/2026/11/12/7e8026ef38f74abeac56977f7b381cb1.png', NULL, NULL),
    ('工具', 'iFixit：免费修理手册', 'https://zh.ifixit.com/', 390, 'upload', 'icons/2026/11/12/4df5f61e7bf0435a995ee90190f5dba7.png', NULL, NULL),
    ('工具', '格式转换', 'https://www.pdfpai.com/', 400, 'upload', 'icons/2026/11/12/a37bce3a8cd7465db16f28d649d0cb77.png', NULL, NULL),
    ('工具', '哲风壁纸', 'https://haowallpaper.com/wallpaperForum', 410, 'upload', 'icons/2026/11/12/18a5e25d5e30433595b71f2047ca778c.ico', NULL, NULL),
    ('工具', 'Bigjpg - AI人工智能图片无', 'https://bigjpg.com/', 420, 'upload', 'icons/2026/11/12/14942dfdb89745cfa5968c98c1490d9d.jpg', NULL, NULL),
    ('工具', '飞搜侠-飞书文档搜索工具_一键搜飞书', 'https://www.feisoo.com/', 430, 'upload', 'icons/2026/11/12/5d6f0db91bb7468a97ad82b30c011539.ico', NULL, NULL),
    ('工具', 'SQL Dialect Conver', 'https://chartdb.io/tools/sql-dialect-converter', 440, 'upload', 'icons/2026/11/12/0c4b7e5a4e4241d4b4833484f854ffc1.ico', NULL, NULL),
    ('工具', '在线Cron表达式生成器', 'https://cron.qqe2.com/', 450, 'text', NULL, 'IRO', '#1681FF'),
    ('工具', 'Markdown 在线编辑器 | 菜', 'https://www.jyshare.com/front-end/712/', 460, 'upload', 'icons/2026/11/12/094ee65553734b819dcb0ad35e8f8e9c.png', NULL, NULL),
    ('工具', '图片尺寸调整', 'https://phototools.org/zh-cn/resize', 470, 'text', NULL, '尺寸', '#F1C40F'),
    ('游戏', '剑网3 官网', 'https://jx3.xoyo.com', 10, 'auto', 'icons/2026/11/12/5507fac322754b3cafbcffcb1f42712d.png', NULL, NULL),
    ('游戏', 'Steam', 'https://store.steampowered.com', 20, 'auto', 'icons/2026/11/12/7400a7015dcd462987c717693d24ca8b.ico', NULL, NULL),
    ('游戏', '激战2星岬岛 - 你的激战2说明书', 'https://gw2.wishingstarmoye.com/', 30, 'upload', 'icons/2026/11/12/e47759d755e944dda912ccbe475da686.png', NULL, NULL),
    ('游戏', '激战2中文维基|激战2资料站|激战2|激', 'http://gw2.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5', 40, 'upload', 'icons/2026/11/12/6269254ee5a047699678e0345293f990.png', NULL, NULL),
    ('游戏', '《激战2》官方网站——颠覆级3D魔幻热血', 'http://gw2.kongzhong.com/index.html', 50, 'upload', 'icons/2026/11/12/f52952e008664a789f1e4cac8cde2848.ico', NULL, NULL),
    ('游戏', '激战2 泰瑞亚探险家协会 | 职业BD', 'https://zx2562.gitee.io/gw2/gw2.voids.cn/index.html', 60, 'text', NULL, '泰尔瑞', '#311F84'),
    ('游戏', '原神WIKI', 'https://wiki.biligame.com/ys/%E9%A6%96%E9%A1%B5', 70, 'upload', 'icons/2026/11/12/8845f939bc1a424c9e0f8fb759a3c1c7.png', NULL, NULL),
    ('游戏', '剑网3 » 魔盒（JX3BOX） - 一', 'https://www.jx3box.com/index/', 80, 'upload', 'icons/2026/11/12/5fc2cbaa550049c78691acf5e4214b1d.png', NULL, NULL),
    ('游戏', '原神地图', 'https://webstatic.mihoyo.com/ys/app/interactive-map/index.html?lang=zh-cn#/map/2?shown_types=&center=2310.00,-907.00&zoom=-3.00', 90, 'upload', 'icons/2026/11/12/b6309b11ef724b228afc20852942d4c6.png', NULL, NULL),
    ('游戏', '《剑网3》官网——次世代国风MMORPG', 'https://jx3.xoyo.com/index/#/', 100, 'upload', 'icons/2026/11/12/8f6f98a08d6c4891b77f92245a486297.png', NULL, NULL),
    ('游戏', '崩坏:星穹铁道WIKI-开拓者笔记-米游', 'https://bbs.mihoyo.com/sr/wiki/?bbs_presentation_style=no_header&utm_source=bbs&utm_medium=mys&utm_campaign=topbar', 110, 'upload', 'icons/2026/11/12/653d4e5af1b2440a8bf6b1951cb239b7.png', NULL, NULL),
    ('游戏', '原神地图', 'https://webstatic.mihoyo.com/ys/app/interactive-map/index.html?bbs_presentation_style=no_header&lang=zh-cn&utm_source=strategy&utm_medium=ys&utm_campaign=icon&_', 120, 'text', NULL, '原神地', '#F1C40F'),
    ('游戏', '首页 | 莫娜占卜铺', 'https://www.mona-uranai.com/intro', 130, 'text', NULL, 'A', '#3B82F6'),
    ('游戏', '激战2星岬岛 地图服务', 'https://gw2.wishingstarmoye.com/map', 140, 'text', NULL, '激战2', '#381825'),
    ('游戏', '余烬谷-雾锁王国互动地图-旅法师营地', 'https://maps.iyingdi.com/enshrouded/embervale', 150, 'upload', 'icons/2026/11/12/4b149319ae244e2dbe5bf9f19b69f759.png', NULL, NULL),
    ('游戏', '交易中心-星际战甲官网-腾讯游戏', 'https://trade.wf.qq.com/detail/1704', 160, 'text', NULL, '交易中', '#1681FF'),
    ('游戏', '最终幻想XIV中文维基 - 灰机wi', 'https://ff14.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5', 170, 'upload', 'icons/2026/11/12/83be281d481044a484492b2d06cbe5b2.png', NULL, NULL),
    ('游戏', '最终幻想14中文攻略站|素素攻略站|', 'https://www.ffxiv.cn/v2/', 180, 'upload', 'icons/2026/11/12/376670ddecf34454a3dccaea6297d9a2.png', NULL, NULL),
    ('游戏', '新大陆见闻录 | 新大陆见闻录 -', 'https://ff14.org/', 190, 'upload', 'icons/2026/11/12/23f2a885580f41a78de92aa700f107c5.ico', NULL, NULL),
    ('游戏', 'Universalis', 'https://universalis.app/', 200, 'upload', 'icons/2026/11/12/6a3cf731016c42ce9c0ced874816ce50.png', NULL, NULL),
    ('游戏', '大国防联军后勤补给站-《最终幻想14', 'https://ff14bjz.sdo.com/RegionKanTelepo?', 210, 'upload', 'icons/2026/11/12/ef5ff0b8e2fd418fbf036bca839581a6.ico', NULL, NULL),
    ('游戏', '狩猎时间表', 'https://www.kdocs.cn/l/csd1ymWeo1HY', 220, 'upload', 'icons/2026/11/12/5277eebba5c54208bf5779bed98fdf40.png', NULL, NULL),
    ('游戏', '光之泥头车时间发布站', 'https://www.ffxivhunt.cn/', 230, 'text', NULL, '光之泥', '#372128'),
    ('游戏', '星', 'https://warframe.huijiwiki.com/wiki/Mainpage', 240, 'upload', 'icons/2026/11/12/6ed55d20cdc4487c87aafd28f9ed4244.png', NULL, NULL),
    ('游戏', '激战2中文维基|激战2资料站|激战2', 'https://gw2.huijiwiki.com/wiki/%E9%A6%96%E9%A1%B5', 250, 'text', NULL, '激战2', '#023373'),
    ('游戏', 'GW2Timer.com/Resou', 'https://gw2timer.com/?page=Map&section=Resource', 260, 'upload', 'icons/2026/11/12/2321469ca6734b5eb0b688c7b2da454f.png', NULL, NULL),
    ('AI', '豆包', 'https://www.doubao.com', 10, 'auto', 'icons/2026/11/12/2eb16fc50af24429bda830c6f323c933.png', NULL, NULL),
    ('AI', 'DashScope', 'https://dashscope.aliyun.com', 20, 'auto', 'icons/2026/11/12/a8c926afaf144c048fb40cd36e085957.ico', NULL, NULL),
    ('AI', '菜鸟教程 - 学的不仅是技术，更是梦', 'https://www.runoob.com/', 30, 'upload', 'icons/2026/11/12/ce346f6d4a614fbd915bd05abd50f4ee.png', NULL, NULL),
    ('AI', '简介 - Python教程 - 廖雪', 'https://liaoxuefeng.com/books/python/introduction/index.html', 40, 'upload', 'icons/2026/11/12/6102c44fd41143c4a8de8a75bdd5a829.png', NULL, NULL),
    ('AI', 'PyPI · The Python', 'https://pypi.org/', 50, 'upload', 'icons/2026/11/12/bc0a4c72369c4324a831213d7ed5b151.png', NULL, NULL),
    ('AI', 'HF-Mirror', 'https://hf-mirror.com/', 60, 'upload', 'icons/2026/11/12/05b756f1a5454e6a93c70cfb52e67afe.ico', NULL, NULL),
    ('AI', '概览 · 魔搭社区', 'https://www.modelscope.cn/my/overview', 70, 'upload', 'icons/2026/11/12/bcdce6c7eed3489aa58e86a7eb3af0ae.ico', NULL, NULL),
    ('AI', 'Tiktokenizer', 'https://tiktokenizer.vercel.app/', 80, 'upload', 'icons/2026/11/12/a1258ce1ebc248b798a394db4427ee9a.png', NULL, NULL),
    ('AI', '大模型服务平台百炼控制台', 'https://bailian.console.aliyun.com/?tab=model#/api-key', 90, 'upload', 'icons/2026/11/12/18131c9c2aa14abfbcd3c1a99db24d1d.png', NULL, NULL),
    ('AI', '模型服务灵积-Token计算器', 'https://dashscope.console.aliyun.com/billing', 100, 'upload', 'icons/2026/11/12/93f7ddd6bed74bdb9b34f8d0082128cd.ico', NULL, NULL),
    ('AI', 'LangChain中文网 - 跟着L', 'https://www.langchain.com.cn/', 110, 'upload', 'icons/2026/11/12/ff32a634bb124f80a93370452761c799.png', NULL, NULL),
    ('AI', 'LangChain 概述 - Lan', 'https://docs.langchain.com/oss/python/langchain/overview', 120, 'upload', 'icons/2026/11/12/86377f91286345848da1999778a53e78.png', NULL, NULL),
    ('AI', 'closeAI', 'https://platform.closeai-asia.com/dashboard/', 130, 'upload', 'icons/2026/11/12/96a3481518574ac4a5d61601fec67e11.ico', NULL, NULL),
    ('AI', '工作室 - Dify', 'https://cloud.dify.ai/apps', 140, 'upload', 'icons/2026/11/12/218b46f3b38f4d3f9d5e4c100ca20f2b.png', NULL, NULL),
    ('AI', '扣子空间，你的 AI 办公空间', 'https://www.coze.cn/overview?utm_medium=daohang&utm_source=itab&utm_term=doutui_hw_coze_itab_nctm9j', 150, 'upload', 'icons/2026/11/12/07c3760163504fc1bf64c93e796dbee0.png', NULL, NULL),
    ('AI', '度加', 'https://aigc.baidu.com/digital/manage', 160, 'upload', 'icons/2026/11/12/259362c757044a52991859712f9ba421.ico', NULL, NULL),
    ('AI', 'MCP Servers', 'https://mcp.so/?spm=5176.28103460.0.0.72ab6308zICxrB', 170, 'upload', 'icons/2026/11/12/1a4731f4eafd44c7aa6574b332295c2f.png', NULL, NULL),
    ('AI', 'LlamaIndex - Llama', 'https://docs.llamaindex.org.cn/en/stable/', 180, 'upload', 'icons/2026/11/12/fe758c760edc4a7aafc1ad4562e84a93.png', NULL, NULL),
    ('AI', 'vLLM', 'https://docs.vllm.ai/en/stable/', 190, 'upload', 'icons/2026/11/12/30d44b3b9a6b4de8875ae225ee0eca05.png', NULL, NULL),
    ('AI', 'neo4j 教程_w3cschool', 'https://www.w3cschool.cn/neo4j/', 200, 'upload', 'icons/2026/11/12/c9571fdd4412492bb59fee8f565750e6.png', NULL, NULL),
    ('AI', 'AI 编程零基础入门教程 Vibe', 'https://ai.codefather.cn/library/2010994846520700929', 210, 'upload', 'icons/2026/11/12/5c70280238ac4e55a438deb7e8178acf.jpg', NULL, NULL),
    ('AI', 'Neo4j 文档 - Neo4j 文', 'https://neo4j.ac.cn/docs/', 220, 'upload', 'icons/2026/11/12/3d6cfed9c18a4b1ca7b5c239b6616305.png', NULL, NULL),
    ('AI', '爬虫工具库-spidertools.', 'https://spidertools.cn/#/curl2Request', 230, 'upload', 'icons/2026/11/12/e81710b8d1844eda8a935263ef504364.ico', NULL, NULL),
    ('AI', 'Llama Hub', 'https://llamahub.ai/?tab=tools', 240, 'upload', 'icons/2026/11/12/7d9de3f2929d44dcb923d5477c93c8f3.png', NULL, NULL),
    ('AI', 'Get Started | Flow', 'https://docs.flowiseai.com/getting-started', 250, 'upload', 'icons/2026/11/12/afd733d8f60941e6b201b152a718732a.png', NULL, NULL),
    ('AI', '纳米AI', 'https://so.n.cn/?fr=none', 260, 'upload', 'icons/2026/11/12/cdca519e7a4a411f85641f9e13b0eb05.ico', NULL, NULL),
    ('AI', 'DeepSeek', 'https://www.deepseek.com/', 270, 'upload', 'icons/2026/11/12/ad8073913fbe4e05b62cfb9b8917c06b.ico', NULL, NULL),
    ('AI', 'Qwen', 'https://qianwen.coml.cc/', 280, 'upload', 'icons/2026/11/12/9b840e54bb4647c19eff7177052eed54.png', NULL, NULL),
    ('AI', 'Z.ai - Inspiring A', 'https://www.zhipuai.cn/zh?spm=5176.28103460.0.0.356f75518n0tKo', 290, 'upload', 'icons/2026/11/12/b6952b61c31845bf9d49285e5b8dbf5e.png', NULL, NULL),
    ('AI', 'App unavailable in', 'https://claude.com/app-unavailable-in-region', 300, 'upload', 'icons/2026/11/12/f1bf13bcfc144fc8bfcf20962420b105.png', NULL, NULL),
    ('AI', 'Tavily', 'https://www.tavily.com/?spm=5176.28103460.0.0.356f75518n0tKo', 310, 'upload', 'icons/2026/11/12/5214f1855451467b88084d66283409bf.png', NULL, NULL),
    ('AI', 'Ragas评估', 'https://www.ragas.io/?spm=5176.28103460.0.0.356f75518n0tKo', 320, 'upload', 'icons/2026/11/12/a04b9e4019864ecb8899d4ff54838f16.ico', NULL, NULL),
    ('AI', 'MCP官网', 'https://modelcontextprotocol.io/docs/getting-started/intro', 330, 'upload', 'icons/2026/11/12/97f7ffa5230946a1a64b57ea8c961713.png', NULL, NULL),
    ('AI', 'n8n', 'https://n8n.io/', 340, 'upload', 'icons/2026/11/12/cbc6f4d0c1c8442ab91ad39bef6f662a.ico', NULL, NULL),
    ('AI', '白日梦AI', 'https://aibrm.com/', 350, 'upload', 'icons/2026/11/12/fcb43665e857489989a4489389df3f7e.png', NULL, NULL),
    ('AI', 'PyTorch', 'https://docs.pytorch.org/docs/2.7/index.html', 360, 'upload', 'icons/2026/11/12/3fc1f50e534f4bad8e7c84536c9997eb.png', NULL, NULL),
    ('AI', 'AI 网站构建器 | 使用 Manu', 'https://manus.im/zh-cn/features/webapp', 370, 'upload', 'icons/2026/11/12/a316d1bd816a458c82f81681ae663643.ico', NULL, NULL),
    ('AI', 'Prompt123.cn - 打造最', 'https://prompt123.cn/#browse', 380, 'text', NULL, 'Pro', '#4B3C36'),
    ('AI', 'Spring AI Alibaba', 'https://java2ai.com/', 390, 'upload', 'icons/2026/11/12/5b6aac74ce724d53a9b6d642dd5947dc.png', NULL, NULL),
    ('AI', 'Plans & pricing:', 'https://bolt.new/', 400, 'upload', 'icons/2026/11/12/67926b058dc743c2bda3aeac516891ce.png', NULL, NULL),
    ('AI', 'AI工具集', 'https://ai-bot.cn/', 410, 'upload', 'icons/2026/11/12/fc3531417f644d3795bd66cc97e2c188.png', NULL, NULL),
    ('AI', 'Spring AI 1.1.8', 'https://docs.spring.io/spring-ai/reference/1.1/api/', 420, 'upload', 'icons/2026/11/12/c7dd57605def43ae97e30213e2f3b10e.png', NULL, NULL),
    ('AI', 'Supabase', 'https://supabase.com/dashboard/project/vekgjdocbwfbzvdpzhuq', 430, 'upload', 'icons/2026/11/12/040cf226614a43f19d3ddd93ef79db1d.png', NULL, NULL),
    ('AI', 'EdgeOne', 'https://console.intl.cloud.tencent.com/edgeone/makers/project/makers-bqsruiopejkr/index', 440, 'upload', 'icons/2026/11/12/0cba98d00a5b4a7a8cdd0800b083a76a.png', NULL, NULL),
    ('AI', '腾讯云', 'https://cloud.tencent.com/act/pro/double11-202611?fromSource=gwzcw.12021792.12021792.12021792&utm_medium=cpc&utm_id=gwzcw.12021792.12021792.12021792&msclkid=275', 450, 'upload', 'icons/2026/11/12/a690568cbbaa4d28ba64a0e999e01731.png', NULL, NULL),
    ('AI', 'Cloudflare', 'https://dash.cloudflare.com/', 460, 'upload', 'icons/2026/11/12/7e8f1a959c1749a29692154c0e192f7b.png', NULL, NULL)
;
-- -----------------------------------------------------------------------------
-- 2. 分类补齐：从临时清单 CROSS JOIN 目标用户，按名称判重（每分类最多一条）
-- -----------------------------------------------------------------------------
INSERT INTO nav_category (user_id, name, icon, sort_order, is_default)
SELECT u.id, v.name, v.icon, v.sort_order, v.is_default
FROM app_user u
CROSS JOIN v_itab_category v
WHERE u.username = 'admin'
  AND NOT EXISTS (
      SELECT 1 FROM nav_category nc
      WHERE nc.user_id = u.id
        AND nc.name = v.name
        AND nc.deleted = FALSE
  );

-- -----------------------------------------------------------------------------
-- 3. 书签首次插入：按 (分类, URL) 判重，保留分类内排序
-- -----------------------------------------------------------------------------
INSERT INTO nav_bookmark (user_id, category_id, title, url, sort_order,
                          icon_type, icon_key, icon_text, icon_color)
SELECT u.id, c.id, v.title, v.url, v.sort_order,
       v.icon_type, v.icon_key, v.icon_text, v.icon_color
FROM app_user u
CROSS JOIN v_itab_bookmark v
JOIN nav_category c
  ON c.user_id = u.id
 AND c.name = v.category_name
 AND c.deleted = FALSE
WHERE u.username = 'admin'
  AND NOT EXISTS (
      SELECT 1 FROM nav_bookmark nb
      WHERE nb.user_id = u.id
        AND nb.category_id = c.id
        AND nb.url = v.url
        AND nb.deleted = FALSE
  );

-- -----------------------------------------------------------------------------
-- 4. 已存在书签：只同步 4 个图标字段（不覆盖标题 / 分类 / 排序；跳过软删除行）
-- -----------------------------------------------------------------------------
UPDATE nav_bookmark nb
SET icon_type = v.icon_type,
    icon_key = v.icon_key,
    icon_text = v.icon_text,
    icon_color = v.icon_color,
    updated_at = now()
FROM app_user u
JOIN nav_category c
  ON c.user_id = u.id
 AND c.deleted = FALSE
JOIN v_itab_bookmark v
  ON v.category_name = c.name
WHERE u.username = 'admin'
  AND nb.user_id = u.id
  AND nb.category_id = c.id
  AND nb.url = v.url
  AND nb.deleted = FALSE
  AND (nb.icon_type IS DISTINCT FROM v.icon_type
       OR nb.icon_key IS DISTINCT FROM v.icon_key
       OR nb.icon_text IS DISTINCT FROM v.icon_text
       OR nb.icon_color IS DISTINCT FROM v.icon_color);

-- -----------------------------------------------------------------------------
-- 5. 导入结果校验（事务内，可引用本次临时清单）
--    清单应固定为 7 / 267；库内数量在线上原本已有书签时会更大，属正常。
-- -----------------------------------------------------------------------------
SELECT '本次清单分类' AS item, (SELECT count(*) FROM v_itab_category)::text AS n
UNION ALL
SELECT '本次清单书签', (SELECT count(*) FROM v_itab_bookmark)::text
UNION ALL
SELECT '库内 admin 分类', (SELECT count(*) FROM nav_category
       WHERE user_id = (SELECT id FROM app_user WHERE username = 'admin') AND deleted = FALSE)::text
UNION ALL
SELECT '库内 admin 书签', (SELECT count(*) FROM nav_bookmark
       WHERE user_id = (SELECT id FROM app_user WHERE username = 'admin') AND deleted = FALSE)::text;

COMMIT;

-- -----------------------------------------------------------------------------
-- 6. 提交后复核（只查真实表；用于确认线上落库结果）
-- -----------------------------------------------------------------------------
SELECT c.name AS category, count(*) AS bookmarks
FROM nav_bookmark b
JOIN nav_category c ON c.id = b.category_id
WHERE b.user_id = (SELECT id FROM app_user WHERE username = 'admin')
  AND b.deleted = FALSE
  AND c.deleted = FALSE
GROUP BY c.name, c.sort_order
ORDER BY c.sort_order;

SELECT icon_type, count(*) AS cnt, count(DISTINCT icon_key) AS unique_keys
FROM nav_bookmark
WHERE user_id = (SELECT id FROM app_user WHERE username = 'admin')
  AND deleted = FALSE
GROUP BY icon_type
ORDER BY icon_type;
