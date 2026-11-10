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
}
