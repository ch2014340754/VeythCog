package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 划词 AI 请求。
 */
@Data
public class QuickAiRequest {

    /** explain / translate / polish / ask */
    private String action = "explain";

    @NotBlank(message = "选中内容不能为空")
    @Size(max = 3200, message = "选中内容过长")
    private String text;

    /** 页面标题，作为解释时的轻量上下文（前端从 document.title 取） */
    @Size(max = 200)
    private String pageTitle;

    /** 是否结合知识库检索（默认关：多数划词要的是通用解释，不是账号内资料） */
    private Boolean withKnowledge;

    /** action=ask 时的问题 */
    @Size(max = 500)
    private String question;

    /** 显式跳过缓存（"重新生成"） */
    private Boolean nocache;
}
