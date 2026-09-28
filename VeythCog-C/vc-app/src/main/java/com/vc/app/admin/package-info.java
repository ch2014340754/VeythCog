/**
 * 系统管理（Admin）—— 应用层功能集，非独立业务域。
 *
 * <p>系统管理是对既有业务域的"管理视图"，横切多个域（宽扇入），因此放在应用装配层 vc-app，
 * 而不单独成域模块。职责与落位：</p>
 * <ul>
 *   <li>用户管理：操作 {@code com.vc.app.auth} 的 User 域（CRUD / 禁用 / 重置密码）</li>
 *   <li>模型目录管理：复用 {@code com.vc.llm} 的 LlmModel 数据（供应商/模型可见性、全局默认）</li>
 *   <li>系统监控：调用量统计 / 在线会话 / 错误日志（Phase 后续建表）</li>
 *   <li>审计日志：登录 / 操作记录（Phase 后续建表）</li>
 *   <li>定时任务：过期清理 / 统计快照（Spring @Scheduled）</li>
 *   <li>系统配置：注册开关 / 公告 / 默认偏好（system_config 表）</li>
 * </ul>
 *
 * <p>对接前端 {@code /admin/*}（当前 mock，见 VeythCog-V 的 api/admin.ts）。</p>
 */
package com.vc.app.admin;
