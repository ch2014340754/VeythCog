package com.vc.app.web;

import lombok.Data;

/**
 * 单模型连通校验请求：apiKey 为前端草稿 AK，可空；为空时使用已保存 AK / 系统兜底。
 */
@Data
public class VerifyRequest {

    /** 本次校验临时使用的 AK，不落库；为空则回落用户已保存 AK、再回落系统兜底 */
    private String apiKey;

    /** 本次校验临时使用的业务空间 ID，不落库；为空则回落已保存 / 系统配置 */
    private String workspaceId;

    /** 本次校验临时使用的地域代码，不落库；为空则回落已保存 / 系统配置 */
    private String region;
}
