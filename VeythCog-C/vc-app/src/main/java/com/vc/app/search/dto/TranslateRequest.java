package com.vc.app.search.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 首行翻译请求。
 */
@Data
public class TranslateRequest {

    @NotBlank(message = "翻译内容不能为空")
    @Size(max = 500, message = "翻译内容过长")
    private String text;

    /** zh / en；为空时按输入内容自动判断 */
    private String targetLang;
}
