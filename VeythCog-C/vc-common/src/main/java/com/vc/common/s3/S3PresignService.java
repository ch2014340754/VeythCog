package com.vc.common.s3;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import com.vc.common.s3.exception.StorageException;
import com.vc.common.s3.exception.StorageNetworkException;
import com.vc.common.s3.exception.StorageServiceException;
import com.vc.common.s3.exception.StorageValidationException;

import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/**
 * 预签名工具：生成"直传/直取"临时 URL，业务后端不中转文件流。
 *
 * <p>两种典型用法：</p>
 * <ul>
 *   <li>前端直传：{@link #presignPutUrl} 生成 PUT 地址 → 前端 PUT 上传 → 回调业务接口落库；</li>
 *   <li>受限读取：{@link #presignGetUrl} 生成带有效期的 GET 地址给前端/外部系统。</li>
 * </ul>
 *
 * <p>签名有效期默认取 {@code storage.s3.presign-expiry}，上限 7 天（S3 SigV4 限制）。</p>
 */
public class S3PresignService {

    /** S3 SigV4 预签名有效期硬上限 */
    private static final Duration MAX_PRESIGN_EXPIRY = Duration.ofDays(7);

    private final S3ClientProvider clientProvider;

    private final S3Properties properties;

    public S3PresignService(S3ClientProvider clientProvider, S3Properties properties) {
        this.clientProvider = clientProvider;
        this.properties = properties;
    }

    /**
     * 生成上传预签名 URL（使用配置的默认有效期，不锁定 Content-Type）。
     *
     * @return 可直接 PUT 的完整 URL
     */
    public String presignPutUrl(S3Bucket bucket, String objectKey) {
        return presignPutUrl(bucket, objectKey, null, null);
    }

    /**
     * 生成上传预签名 URL，并锁定 Content-Type。
     *
     * <p>注意：Content-Type 一旦参与签名，上传时必须原样带上该请求头，否则签名校验失败；
     * 需要前端自由决定类型时用不锁定类型的重载。</p>
     *
     * @param contentType 期望的 MIME 类型，null 表示不锁定
     * @param expiry      有效期，null 表示用默认值
     */
    public String presignPutUrl(S3Bucket bucket, String objectKey, String contentType, Duration expiry) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        Duration signatureDuration = resolveExpiry(expiry);
        PutObjectRequest.Builder requestBuilder = PutObjectRequest.builder()
                .bucket(targetBucket.getBucketName())
                .key(key);
        if (contentType != null && !contentType.trim().isEmpty()) {
            requestBuilder.contentType(contentType.trim());
        }
        try {
            return clientProvider.getS3Presigner()
                    .presignPutObject(PutObjectPresignRequest.builder()
                            .signatureDuration(signatureDuration)
                            .putObjectRequest(requestBuilder.build())
                            .build())
                    .url()
                    .toString();
        } catch (S3Exception e) {
            throw new StorageServiceException("生成上传预签名", targetBucket.getBucketName(), key,
                    e.statusCode(), e.awsErrorDetails() == null ? null : e.awsErrorDetails().errorCode(), e);
        } catch (SdkClientException e) {
            throw new StorageNetworkException("生成上传预签名", targetBucket.getBucketName(), key, e);
        }
    }

    /**
     * 生成下载预签名 URL（使用配置的默认有效期）。
     */
    public String presignGetUrl(S3Bucket bucket, String objectKey) {
        return presignGetUrl(bucket, objectKey, (String) null, null);
    }

    /**
     * 生成下载预签名 URL。
     *
     * @param expiry 有效期，null 表示用默认值
     */
    public String presignGetUrl(S3Bucket bucket, String objectKey, Duration expiry) {
        return presignGetUrl(bucket, objectKey, (String) null, expiry);
    }

    /**
     * 生成下载预签名 URL，并指定下载时的文件名（浏览器另存为的文件名）。
     *
     * <p>文件名通过 {@code response-content-disposition} 带在签名里，中文会做 RFC 5987 编码，
     * 避免落到下载文件名乱码。</p>
     *
     * @param downloadFilename 期望的下载文件名，null 表示不指定
     * @param expiry           有效期，null 表示用默认值
     */
    public String presignGetUrl(S3Bucket bucket, String objectKey, String downloadFilename, Duration expiry) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        Duration signatureDuration = resolveExpiry(expiry);
        GetObjectRequest.Builder requestBuilder = GetObjectRequest.builder()
                .bucket(targetBucket.getBucketName())
                .key(key);
        String safeFilename = sanitizeFilename(downloadFilename);
        if (safeFilename != null) {
            requestBuilder.responseContentDisposition(contentDisposition(safeFilename));
        }
        try {
            return clientProvider.getS3Presigner()
                    .presignGetObject(GetObjectPresignRequest.builder()
                            .signatureDuration(signatureDuration)
                            .getObjectRequest(requestBuilder.build())
                            .build())
                    .url()
                    .toString();
        } catch (S3Exception e) {
            throw new StorageServiceException("生成下载预签名", targetBucket.getBucketName(), key,
                    e.statusCode(), e.awsErrorDetails() == null ? null : e.awsErrorDetails().errorCode(), e);
        } catch (SdkClientException e) {
            throw new StorageNetworkException("生成下载预签名", targetBucket.getBucketName(), key, e);
        }
    }

    /**
     * 生成公开桶的对象直链（不签名、不带有效期）。
     *
     * <p>仅对 {@link S3Bucket#isAnonymousReadable()} 为 true 的桶可用；
     * 私有桶必须走 {@link #presignGetUrl}，避免把私有资源地址泄露出去。</p>
     */
    public String publicUrl(S3Bucket bucket, String objectKey) {
        S3Bucket targetBucket = requireBucket(bucket);
        String key = S3ObjectKeyUtils.requireValidKey(objectKey);
        if (!targetBucket.isAnonymousReadable()) {
            throw new StorageValidationException(
                    "桶 " + targetBucket.getBucketName() + " 为私有桶，不提供公开直链，请使用下载预签名 URL");
        }
        // 公开直链同样要给浏览器用，优先取公网 endpoint（内网 endpoint 外部解析不了）
        String publicEndpoint = properties.getPublicEndpoint();
        String endpoint = publicEndpoint != null && !publicEndpoint.trim().isEmpty()
                ? publicEndpoint
                : properties.getEndpoint();
        if (endpoint == null || endpoint.trim().isEmpty()) {
            throw new StorageException(StorageException.StorageErrorType.CONFIGURATION,
                    "生成公开直链需要配置 storage.s3.endpoint");
        }
        String base = endpoint.trim().replaceAll("/+$", "");
        return base + "/" + targetBucket.getBucketName() + "/" + encodeKeyPath(key);
    }

    private Duration resolveExpiry(Duration requested) {
        Duration expiry = requested != null ? requested : properties.getPresignExpiry();
        if (expiry == null) {
            expiry = Duration.ofMinutes(15);
        }
        if (expiry.isZero() || expiry.isNegative()) {
            throw new StorageValidationException("预签名有效期必须大于 0");
        }
        if (expiry.compareTo(MAX_PRESIGN_EXPIRY) > 0) {
            throw new StorageValidationException("预签名有效期不能超过 7 天（S3 SigV4 限制）");
        }
        return expiry;
    }

    private static S3Bucket requireBucket(S3Bucket bucket) {
        if (bucket == null) {
            throw new StorageValidationException("桶不能为空，请使用 S3Bucket 枚举");
        }
        return bucket;
    }

    /** 去掉换行与引号，防止 header 注入 */
    private static String sanitizeFilename(String filename) {
        if (filename == null || filename.trim().isEmpty()) {
            return null;
        }
        String cleaned = filename.replace("\r", "").replace("\n", "").replace("\"", "").trim();
        return cleaned.isEmpty() ? null : cleaned;
    }

    /**
     * 组装下载文件名 header：普通 filename 原样传（SDK 会对 query 值做一次百分号编码，
     * 服务端解码后即为原始 UTF-8 文件名），filename* 按 RFC 5987 给出编码后的备选值。
     */
    private static String contentDisposition(String filename) {
        String percentEncoded = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + percentEncoded;
    }

    /** 按路径分段做百分号编码，保留对象 key 里的 "/" 层级 */
    private static String encodeKeyPath(String key) {
        String[] segments = key.split("/", -1);
        StringBuilder builder = new StringBuilder(key.length());
        for (int i = 0; i < segments.length; i++) {
            if (i > 0) {
                builder.append('/');
            }
            builder.append(URLEncoder.encode(segments[i], StandardCharsets.UTF_8).replace("+", "%20"));
        }
        return builder.toString();
    }
}
