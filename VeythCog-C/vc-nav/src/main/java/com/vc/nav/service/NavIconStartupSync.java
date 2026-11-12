package com.vc.nav.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 启动时补同步历史书签图标到 S3 {@code public-icons}。
 *
 * <p>幂等：只处理 {@code icon_type=auto} 且没有 {@code icon_key} 的书签；
 * 走 {@link NavIconService#syncMissingAsync} 的守护线程池，不阻塞启动。
 * 可用 {@code nav.icon.sync-on-startup=false} 关闭（例如离线演示环境）。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "nav.icon", name = "sync-on-startup",
        havingValue = "true", matchIfMissing = true)
public class NavIconStartupSync {

    /** 单次启动最多补多少条，避免历史脏数据把启动拖成大批量抓取 */
    private static final int STARTUP_SYNC_LIMIT = 200;

    private final NavIconService iconService;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("导航图标启动同步已投递（最多 {} 条）", STARTUP_SYNC_LIMIT);
        iconService.syncMissingAsync(STARTUP_SYNC_LIMIT);
    }
}
