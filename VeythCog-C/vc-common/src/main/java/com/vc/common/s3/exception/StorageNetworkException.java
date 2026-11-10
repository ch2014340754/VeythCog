package com.vc.common.s3.exception;

/**
 * 网络层 / 客户端侧存储异常：连不上对象存储、读超时、凭据被拒绝等。
 *
 * <p>通常是可重试的瞬态故障，也可能是 endpoint、网络策略或 AK/SK 配错，
 * 上层可结合日志中的操作名、桶、key 判定，必要时做有限重试或降级。</p>
 */
public class StorageNetworkException extends StorageException {

    public StorageNetworkException(String message) {
        super(StorageErrorType.NETWORK, message);
    }

    public StorageNetworkException(String message, Throwable cause) {
        super(StorageErrorType.NETWORK, message, cause);
    }

    public StorageNetworkException(String operation, String bucketName, String objectKey, Throwable cause) {
        super(StorageErrorType.NETWORK,
                String.format("对象存储网络异常：%s失败，bucket=%s，key=%s，原因=%s",
                        operation, bucketName, objectKey, cause == null ? "unknown" : cause.getMessage()),
                cause);
    }
}
