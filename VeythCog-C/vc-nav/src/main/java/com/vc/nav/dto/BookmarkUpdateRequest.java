package com.vc.nav.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新书签请求。
 */
@Data
public class BookmarkUpdateRequest {

    private Long categoryId;

    @NotBlank(message = "书签名不能为空")
    @Size(max = 64, message = "书签名最长 64 字")
    private String title;

    @NotBlank(message = "URL 不能为空")
    @Size(max = 512, message = "URL 最长 512 字符")
    private String url;

    /** 图标来源：auto / upload / text；不传表示保持原图标 */
    @Size(max = 16, message = "图标类型最长 16 字符")
    private String iconType;

    /** public-icons 对象 key（获取图标 / 上传图标返回） */
    @Size(max = 512, message = "图标 key 最长 512 字符")
    private String iconKey;

    /** 文字图标内容（1~3 字符） */
    @Size(max = 8, message = "图标文字最长 8 字符")
    private String iconText;

    /** 文字图标底色 #RRGGBB */
    @Size(max = 16, message = "图标颜色最长 16 字符")
    private String iconColor;
}
