package com.vc.music.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 曲目下发结构。
 *
 * <p>{@code streamUrl} 是后端按需生成的短时签名地址（5 分钟、绑定当前用户 + 曲目），
 * 前端直接塞给 {@code <audio src>}，因此不能走 Authorization 头。S3 不可用时置空，
 * 前端据此显示「音频暂不可用」。</p>
 */
@Data
public class MusicTrackView implements Serializable {

    private Long id;

    private String title;

    private String artist;

    /** 时长（毫秒） */
    private int durationMs;

    /** 封面双色渐变（缺失时前端按标题 hash 兜底） */
    private List<String> coverColor;

    private String source;

    private String license;

    private String attribution;

    private String licenseUrl;

    /** AI 生成标识：前端必须展示「AI 生成」 */
    private boolean aiDisclosure;

    private String aiModel;

    private List<String> tags;

    private boolean ambientEnabled;

    private int ambientOrder;

    private String status;

    /** 创建 / 更新时间（epoch 毫秒，对齐 api-spec 通用约定） */
    private long createdAt;

    private long updatedAt;

    /** 播流地址（短时签名）；S3 不可用时为空串 */
    private String streamUrl;
}
