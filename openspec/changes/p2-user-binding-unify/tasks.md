# tasks · p2-user-binding-unify

> 状态：**已 apply 完成**（2026-11-15），全部验收项通过。

> 严格按序执行，每项完成即验证，不跳序。全部完成后才做「记录改动」。

## T1 脚本与备份
- [x] T1.1 写 `VeythCog-C/docs/sql/022_user_setting.sql`（建表 + 索引 + DO 块迁移 + `DROP nav_setting`，幂等）
- [x] T1.2 执行前记录 `SELECT count(*) FROM nav_setting;` 与逐账号三列快照（存临时文件，收尾删除）
- [x] T1.3 在 `012_nav.sql` 头部加一行注释：`nav_setting 已被 022_user_setting.sql 取代`
- [x] T1.4 `docs/sql/README` 补执行顺序 `021 → 022` 与「DROP 前先备份」

## T2 vc-user 模块
- [x] T2.1 新建 `vc-user/pom.xml`（vc-common + mybatis-plus starter + postgresql）
- [x] T2.2 根 `pom.xml` `<modules>` 在 `vc-nav` 之前加 `vc-user`
- [x] T2.3 `UserSetting` 实体（`@TableName("user_setting")`、`@TableId userId`）
- [x] T2.4 `UserSettingMapper`（`BaseMapper<UserSetting>`）
- [x] T2.5 `UserSettingService`：`get(userId)` 默认兜底、`patch(userId, req)` upsert、`updateWallpaperKey(userId, key)`
- [x] T2.6 `dto/UserSettingView`、`dto/UserSettingPatch`（含 `clear` 白名单校验）
- [x] T2.7 `mvn -q -pl vc-user -am -DskipTests compile` 通过

## T3 vc-nav 改造
- [x] T3.1 `vc-nav/pom.xml` 加 `vc-user` 依赖
- [x] T3.2 删除 `vc-nav/entity/NavSetting.java`、`vc-nav/mapper/NavSettingMapper.java`
- [x] T3.3 `NavSettingService` 改薄：`get(userId)` 返回 `UserSettingView`（或直接由 bootstrap 调 `UserSettingService`）
- [x] T3.4 `NavBootstrapView.setting` 类型改 `UserSettingView`
- [x] T3.5 `NavWallpaperService.current/lock` 改走 `UserSettingService`（S3 校验逻辑不动）
- [x] T3.6 `NavBootstrapService` 改注入 `UserSettingService`
- [x] T3.7 `mvn -q -pl vc-nav -am -DskipTests compile` 通过

## T4 vc-app 装配 + 接口
- [x] T4.1 `VcAppApplication` `@MapperScan` 增加 `"com.vc.user.setting"`
- [x] T4.2 `vc-app/pom.xml` 加 `vc-user` 依赖
- [x] T4.3 新增 `web/UserSettingController`：`GET /user/setting`、`PUT /user/setting`
- [x] T4.4 `NavSettingController` 删除 `/setting` GET/PUT，保留 bootstrap + 壁纸四接口
- [x] T4.5 `mvn -q -DskipTests compile` 全仓通过
- [x] T4.6 `grep -r "NavSetting\b|nav_setting"` 后端零残留（注释除外）

## T5 数据库执行
- [x] T5.1 备份：`pg_dump -t nav_setting`
- [x] T5.2 执行 `022_user_setting.sql`（JDK `ApplySql` 或 psql）
- [x] T5.3 校验：`nav_setting` 不存在、`user_setting` 行数与迁移前一致、三列逐账号比对通过
- [x] T5.4 复跑一次 022，确认幂等且不覆盖

## T6 前端
- [x] T6.1 新建 `src/api/user.ts`（`getUserSetting` / `updateUserSetting`）
- [x] T6.2 `src/api/nav.ts` 删除 `getNavSetting` / `updateNavSetting`（`NavSetting` 类型保留）
- [x] T6.3 `src/stores/navStore.ts` 三处调用切到 `user.ts`
- [x] T6.4 `grep -r "nav/setting" src` 零残留
- [x] T6.5 `npm run build` 通过

## T7 真实链路验证（质量门）
- [x] T7.1 `pwsh VeythCog-C/scripts/dev.ps1` 起后端+前端
- [x] T7.2 登录 admin → 首页：搜索框默认引擎、上次分类、锁定壁纸与改造前一致
- [x] T7.3 `GET /api/user/setting` 与 `GET /api/nav/bootstrap` 的 `setting` 字段一致
- [x] T7.4 改搜索引擎 → 刷新仍生效；切分类 → 刷新仍回到该分类
- [x] T7.5 锁定/解锁壁纸 → 刷新行为正确
- [x] T7.6 验证完成后停掉本次启动的前后端进程（`dev.ps1 stop`），不留后台进程

## T8 文档收尾
- [x] T8.1 `PROJECT_MEMORY.md`：§3.1 模块依赖加 `vc-user`；§3.2 补 `vc-user` 职责；§5 表清单 `nav_setting` → `user_setting` 并写明边界；§6 接口表删除 `/nav/setting`、新增 `/user/setting`；§8 补 022 脚本；信息基准日期改 2026-11-15
- [x] T8.2 `audit.md` 结论同步（本变更完成后 #6 标为已办结）
- [x] T8.3 清理本轮所有临时文件（备份 dump、快照 txt、日志）
