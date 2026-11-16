package com.vc.music.dto;

import lombok.Data;

import java.util.List;

/**
 * 元信息更新请求（{@code null} / 省略字段 = 不修改）。
 *
 * <p>只允许改元信息，不动 {@code object_key} / 播放对象：换音频请重新上传。</p>
 */
@Data
public class TrackUpdateRequest {

    private String title;

    private String artist;

    private List<String> tags;

    private String source;

    private String license;

    private String attribution;

    private String licenseUrl;

    private Boolean aiDisclosure;

    private String aiModel;

    /** published / hidden */
    private String status;
}
