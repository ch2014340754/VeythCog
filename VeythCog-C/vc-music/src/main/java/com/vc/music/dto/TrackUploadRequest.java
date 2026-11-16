package com.vc.music.dto;

import lombok.Data;

import java.util.List;

/**
 * 上传时随文件一起提交的元信息（multipart 表单字段）。
 */
@Data
public class TrackUploadRequest {

    /** 标题，留空取文件名（不含后缀） */
    private String title;

    private String artist;

    /** 时长（毫秒），前端用临时 {@code <audio>} 读 metadata 后提交 */
    private Integer durationMs;

    /** 来源，默认 UPLOAD */
    private String source;

    /** 许可，默认 OWNED；CC-BY-NC 会被后端直接拒绝 */
    private String license;

    private String attribution;

    private String licenseUrl;

    /** AI 生成标识 */
    private Boolean aiDisclosure;

    /** AI 模型标识（aiDisclosure=true 时必填） */
    private String aiModel;

    private List<String> tags;
}
