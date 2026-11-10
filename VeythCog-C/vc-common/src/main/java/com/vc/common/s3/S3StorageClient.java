package com.vc.common.s3;

import java.io.InputStream;
import java.nio.file.Path;
import java.util.function.Supplier;

import com.vc.common.s3.exception.StorageNetworkException;
import com.vc.common.s3.exception.StorageServiceException;
import com.vc.common.s3.exception.StorageValidationException;

import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * S3 通用存储客户端：仅提供对象级基础设施能力（上传 / 删除 / 存在性判断）。
 *
 * <p>不做任何业务判断：文件大小限制、后缀白名单、归属校验、落库都由业务模块自行控制。
 * 所有异常都转成 {@link com.vc.common.s3.exception.StorageException} 家族，
 * 区分网络异常与服务端异常，避免业务层直接感知 AWS SDK 类型。</p>
 *
 * <p>幂等性：{@link #delete} 对不存在的对象视为成功（S3 语义为幂等删除）；同名 key 上传为覆盖写。</p>
 */
public class S3StorageClient {

    private final S3ClientProvider clientProvider;

    public S3StorageClient(S3ClientProvider clientProvider) {
        this.clientProvider = clientProvider;
    }

    /**
     * 上传字节数组（小文件首选，长度已知）。
     *
     * @param bucket      目标桶
     * @param objectKey   对象 key，不能为空（可由 {@link S3ObjectKeyUtils#buildKey} 生成）
     * @param content     文件内容
     * @param contentType MIME 类型，如 image/png；写入对象元数据，供浏览器直接渲染使用
     * @return putObject 响应（含 ETag、版本号等）
     */
    public PutObjectResponse upload(S3Bucket bucket, String objectKey, byte[] content, String contentType) {
        if (content == null) {
            throw new StorageValidationException("上传内容不能为空");
        }
        return upload(bucket, objectKey, content, content.length, contentType);
    }

    /**
     * 上传字节数组并显式声明长度（与 {@link #upload(S3Bucket, String, byte[], String)} 等价，
     * 保留重载以便业务侧统一走长度参数）。
     */
    public PutObjectResponse upload(S3Bucket bucket, String objectKey, byte[] content,
                                    long contentLength, String contentType) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        if (content == null || content.length == 0) {
            throw new StorageValidationException("上传内容不能为空");
        }
        if (contentLength <= 0) {
            throw new StorageValidationException("contentLength 必须大于 0");
        }
        return execute("上传", targetBucket, key, () -> client().putObject(
                putObjectRequest(targetBucket, key, contentType).build(),
                RequestBody.fromBytes(content)));
    }

    /**
     * 上传输入流。
     *
     * <p>必须提供准确的 {@code contentLength}：S3 签名需要提前知道长度，长度不符会直接抛异常；
     * 长度未知请先落临时文件改用 {@link #upload(S3Bucket, String, Path, String)}。</p>
     *
     * @param inputStream 文件流，由调用方负责关闭
     */
    public PutObjectResponse upload(S3Bucket bucket, String objectKey, InputStream inputStream,
                                    long contentLength, String contentType) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        if (inputStream == null) {
            throw new StorageValidationException("上传文件流不能为空");
        }
        if (contentLength <= 0) {
            throw new StorageValidationException("上传文件流必须提供准确的 contentLength（未知长度请改用 Path 重载）");
        }
        return execute("上传", targetBucket, key, () -> client().putObject(
                putObjectRequest(targetBucket, key, contentType).build(),
                RequestBody.fromInputStream(inputStream, contentLength)));
    }

    /**
     * 上传本地文件（大文件首选，SDK 内部按文件大小决定是否分片）。
     */
    public PutObjectResponse upload(S3Bucket bucket, String objectKey, Path file, String contentType) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        if (file == null) {
            throw new StorageValidationException("上传文件路径不能为空");
        }
        return execute("上传", targetBucket, key, () -> client().putObject(
                putObjectRequest(targetBucket, key, contentType).build(),
                RequestBody.fromFile(file)));
    }

    /**
     * 删除对象（幂等：对象不存在不报错）。
     */
    public void delete(S3Bucket bucket, String objectKey) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        executeVoid("删除", targetBucket, key, () -> client().deleteObject(
                DeleteObjectRequest.builder()
                        .bucket(targetBucket.getBucketName())
                        .key(key)
                        .build()));
    }

    /**
     * 判断对象是否存在。
     *
     * <p>内部用 HEAD 请求，只返回元信息不取内容；不存在返回 false，其它错误照常抛出。</p>
     */
    public boolean exists(S3Bucket bucket, String objectKey) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        try {
            client().headObject(HeadObjectRequest.builder()
                    .bucket(targetBucket.getBucketName())
                    .key(key)
                    .build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw new StorageServiceException("查询对象是否存在", targetBucket.getBucketName(), key,
                    e.statusCode(), errorCodeOf(e), e);
        } catch (SdkClientException e) {
            throw new StorageNetworkException("查询对象是否存在", targetBucket.getBucketName(), key, e);
        }
    }

    private S3Client client() {
        return clientProvider.getS3Client();
    }

    private static PutObjectRequest.Builder putObjectRequest(S3Bucket bucket, String key, String contentType) {
        PutObjectRequest.Builder builder = PutObjectRequest.builder()
                .bucket(bucket.getBucketName())
                .key(key);
        if (contentType != null && !contentType.trim().isEmpty()) {
            builder.contentType(contentType.trim());
        }
        return builder;
    }

    private static S3Bucket requireBucket(S3Bucket bucket) {
        if (bucket == null) {
            throw new StorageValidationException("桶不能为空，请使用 S3Bucket 枚举");
        }
        return bucket;
    }

    private <T> T execute(String operation, S3Bucket bucket, String key, Supplier<T> action) {
        try {
            return action.get();
        } catch (S3Exception e) {
            throw new StorageServiceException(operation, bucket.getBucketName(), key,
                    e.statusCode(), errorCodeOf(e), e);
        } catch (SdkClientException e) {
            throw new StorageNetworkException(operation, bucket.getBucketName(), key, e);
        }
    }

    private void executeVoid(String operation, S3Bucket bucket, String key, Runnable action) {
        execute(operation, bucket, key, () -> {
            action.run();
            return null;
        });
    }

    private static String errorCodeOf(S3Exception e) {
        return e.awsErrorDetails() == null ? null : e.awsErrorDetails().errorCode();
    }
}
