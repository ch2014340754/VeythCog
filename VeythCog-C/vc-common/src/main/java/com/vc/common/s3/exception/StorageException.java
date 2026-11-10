package com.vc.common.s3.exception;

import lombok.Getter;

/**
 * 对象存储基础设施异常（父类）。
 *
 * <p>只表达"基础设施层出了什么问题"，不携带业务错误码；业务模块需要面向前端时，
 * 自行 catch 后转成 {@code BusinessException} / {@code ErrorCode}，避免业务错误码污染公共库。</p>
 */
@Getter
public class StorageException extends RuntimeException {

    /** 异常分类，便于上层按类型做统一处理（降级、重试、提示） */
    private final StorageErrorType errorType;

    public StorageException(StorageErrorType errorType, String message) {
        super(message);
        this.errorType = errorType;
    }

    public StorageException(StorageErrorType errorType, String message, Throwable cause) {
        super(message, cause);
        this.errorType = errorType;
    }

    /**
     * 存储异常分类。
     */
    public enum StorageErrorType {

        /** 配置缺失或非法（endpoint / AK / SK 未填、endpoint 不是合法 URL 等），属于部署问题，重试无意义 */
        CONFIGURATION,

        /** 网络层异常：连接失败、超时、DNS、客户端侧签名/凭据不被识别等 */
        NETWORK,

        /** 存储服务端返回的错误：4xx/5xx、桶不存在、无权限、Key 冲突等 */
        SERVICE,

        /** 入参校验失败：文件类型、后缀、大小、对象 key 非法等，属于调用方问题 */
        VALIDATION
    }
}
