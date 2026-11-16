package com.vc.music.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 音乐库配置（{@code music.*}）。
 *
 * <p>播流签名密钥只走环境变量 / {@code application-local.yml}，默认值仅用于本地开发，
 * 生产必须通过 {@code MUSIC_STREAM_SECRET} 覆盖。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "music")
public class MusicProperties {

    /** 播流 token 的 HMAC 密钥 */
    private String streamSecret = "dev-only-music-stream-secret-change-me";

    /** 播流 token 有效期（分钟） */
    private int streamTokenMinutes = 5;

    /** 背景音池上限（首） */
    private int ambientMax = 8;

    /** 单文件大小上限（字节），默认 20MB */
    private long maxFileBytes = 20L * 1024 * 1024;

    /** 时长上限（毫秒），默认 10 分钟 */
    private long maxDurationMs = 600_000L;

    /** 列表单页上限 */
    private int pageSizeMax = 200;
}
