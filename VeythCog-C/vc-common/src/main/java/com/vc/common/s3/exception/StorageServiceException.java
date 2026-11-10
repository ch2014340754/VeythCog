package com.vc.common.s3.exception;

import lombok.Getter;

/**
 * 存储服务端异常：HTTP 状态码非 2xx（桶不存在、无权限、对象不存在、限流、5xx 等）。
 *
 * <p>保留状态码与 S3 错误码，便于排障；{@code cause} 为原始 {@code S3Exception}。</p>
 */
@Getter
public class StorageServiceException extends StorageException {

    /** 操作名，如"上传""删除""查询对象是否存在" */
    private final String operation;

    /** 桶名 */
    private final String bucketName;

    /** 对象 key */
    private final String objectKey;

    /** HTTP 状态码，SDK 未提供时为 0 */
    private final int statusCode;

    /** S3 错误码，如 NoSuchBucket / AccessDenied / InvalidAccessKeyId，可能为 null */
    private final String s3ErrorCode;

    public StorageServiceException(String operation, String bucketName, String objectKey,
                                   int statusCode, String s3ErrorCode, Throwable cause) {
        super(StorageErrorType.SERVICE,
                String.format("对象存储服务异常：%s失败，bucket=%s，key=%s，status=%d，s3Error=%s",
                        operation, bucketName, objectKey, statusCode, s3ErrorCode),
                cause);
        this.operation = operation;
        this.bucketName = bucketName;
        this.objectKey = objectKey;
        this.statusCode = statusCode;
        this.s3ErrorCode = s3ErrorCode;
    }

    public StorageServiceException(String message, Throwable cause) {
        super(StorageErrorType.SERVICE, message, cause);
        this.operation = null;
        this.bucketName = null;
        this.objectKey = null;
        this.statusCode = 0;
        this.s3ErrorCode = null;
    }
}
