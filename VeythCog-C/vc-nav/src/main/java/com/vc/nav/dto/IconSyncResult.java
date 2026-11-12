package com.vc.nav.dto;

/**
 * 缺失图标同步结果。
 *
 * @param total   本次候选数量
 * @param success 成功补齐数量
 * @param failed  失败数量（已写 icon_synced_at，1 天后才重试）
 */
public record IconSyncResult(int total, int success, int failed) {
}
