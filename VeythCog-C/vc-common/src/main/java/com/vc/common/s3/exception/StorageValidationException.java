package com.vc.common.s3.exception;

/**
 * 存储入参校验异常：文件后缀 / MIME 不在允许范围、真实类型与后缀不一致、对象 key 非法、
 * 预签名有效期越界等。
 *
 * <p>属于调用方问题，不应重试；业务层可以 catch 后转成参数错误返回给前端。</p>
 */
public class StorageValidationException extends StorageException {

    public StorageValidationException(String message) {
        super(StorageErrorType.VALIDATION, message);
    }

    public StorageValidationException(String message, Throwable cause) {
        super(StorageErrorType.VALIDATION, message, cause);
    }
}
