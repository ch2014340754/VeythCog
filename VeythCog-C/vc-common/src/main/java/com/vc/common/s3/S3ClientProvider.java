package com.vc.common.s3;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import com.vc.common.s3.exception.StorageException;

import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * S3 客户端持有者：首次真正调用存储能力时才构建客户端。
 *
 * <p>为什么延迟构建：存储是可选基础设施，配置缺失不应该让整个应用起不来。
 * 未配置时启动只打 WARN，业务真正触发上传/预签名时才抛
 * {@link StorageException.StorageErrorType#CONFIGURATION}，既不影响其它功能，
 * 也不会出现"配置错误被静默吞掉"。</p>
 *
 * <p>实现说明：</p>
 * <ul>
 *   <li>统一走 {@code UrlConnectionHttpClient}（纯 JDK 实现，无额外传递依赖）；</li>
 *   <li>强制 pathStyle，适配 RustFS / MinIO；换成虚拟主机风格的厂商时改配置即可；</li>
 *   <li>客户端与本类同生命周期，容器销毁时由 Spring 调 {@link #close()} 释放连接池。</li>
 * </ul>
 */
@Slf4j
public class S3ClientProvider implements AutoCloseable {

    private final S3Properties properties;

    private volatile S3Client s3Client;

    private volatile S3Presigner s3Presigner;

    public S3ClientProvider(S3Properties properties) {
        this.properties = properties;
        if (!isConfigured(properties)) {
            log.warn("对象存储未配置完整（storage.s3.endpoint / access-key / secret-key），存储相关功能在被调用时会报配置异常");
        }
    }

    /**
     * 获取 S3 客户端（线程安全，懒加载一次）。
     *
     * @throws StorageException 配置不完整或客户端构建失败
     */
    public S3Client getS3Client() {
        S3Client client = this.s3Client;
        if (client == null) {
            synchronized (this) {
                client = this.s3Client;
                if (client == null) {
                    client = buildClient();
                    this.s3Client = client;
                }
            }
        }
        return client;
    }

    /**
     * 获取预签名器（线程安全，懒加载一次）。
     *
     * @throws StorageException 配置不完整或预签名器构建失败
     */
    public S3Presigner getS3Presigner() {
        S3Presigner presigner = this.s3Presigner;
        if (presigner == null) {
            synchronized (this) {
                presigner = this.s3Presigner;
                if (presigner == null) {
                    presigner = buildPresigner();
                    this.s3Presigner = presigner;
                }
            }
        }
        return presigner;
    }

    @Override
    public void close() {
        if (this.s3Client != null) {
            this.s3Client.close();
            this.s3Client = null;
        }
        if (this.s3Presigner != null) {
            this.s3Presigner.close();
            this.s3Presigner = null;
        }
    }

    private S3Client buildClient() {
        S3Properties props = validatedProperties();
        try {
            S3Client client = S3Client.builder()
                    .endpointOverride(URI.create(props.getEndpoint()))
                    .region(Region.of(props.getRegion()))
                    .credentialsProvider(credentialsProvider(props))
                    .serviceConfiguration(s3Configuration(props))
                    .httpClientBuilder(UrlConnectionHttpClient.builder()
                            .connectionTimeout(props.getConnectTimeout())
                            .socketTimeout(props.getSocketTimeout()))
                    .build();
            log.info("对象存储客户端已初始化：endpoint={}，region={}，pathStyle={}",
                    props.getEndpoint(), props.getRegion(), props.isPathStyleAccess());
            return client;
        } catch (RuntimeException e) {
            throw new StorageException(StorageException.StorageErrorType.CONFIGURATION,
                    "对象存储客户端构建失败：" + e.getMessage(), e);
        }
    }

    private S3Presigner buildPresigner() {
        S3Properties props = validatedProperties();
        try {
            return S3Presigner.builder()
                    .endpointOverride(URI.create(props.getEndpoint()))
                    .region(Region.of(props.getRegion()))
                    .credentialsProvider(credentialsProvider(props))
                    .serviceConfiguration(s3Configuration(props))
                    .build();
        } catch (RuntimeException e) {
            throw new StorageException(StorageException.StorageErrorType.CONFIGURATION,
                    "对象存储预签名器构建失败：" + e.getMessage(), e);
        }
    }

    private static StaticCredentialsProvider credentialsProvider(S3Properties props) {
        return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(props.getAccessKey().trim(), props.getSecretKey().trim()));
    }

    private static S3Configuration s3Configuration(S3Properties props) {
        return S3Configuration.builder()
                .pathStyleAccessEnabled(props.isPathStyleAccess())
                .build();
    }

    private static boolean isConfigured(S3Properties props) {
        return props != null
                && !isBlank(props.getEndpoint())
                && !isBlank(props.getAccessKey())
                && !isBlank(props.getSecretKey());
    }

    /**
     * 校验配置并返回；缺失项一次性全部报出来，避免用户改一条重启一次。
     */
    private S3Properties validatedProperties() {
        List<String> missing = new ArrayList<>();
        if (properties == null) {
            throw new StorageException(StorageException.StorageErrorType.CONFIGURATION,
                    "对象存储配置缺失：storage.s3.* 未绑定");
        }
        if (isBlank(properties.getEndpoint())) {
            missing.add("storage.s3.endpoint（环境变量 RUSTFS_ENDPOINT）");
        }
        if (isBlank(properties.getAccessKey())) {
            missing.add("storage.s3.access-key（环境变量 RUSTFS_ACCESS_KEY）");
        }
        if (isBlank(properties.getSecretKey())) {
            missing.add("storage.s3.secret-key（环境变量 RUSTFS_SECRET_KEY）");
        }
        if (!missing.isEmpty()) {
            throw new StorageException(StorageException.StorageErrorType.CONFIGURATION,
                    "对象存储配置不完整，缺少：" + String.join("、", missing));
        }
        try {
            URI uri = URI.create(properties.getEndpoint().trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                throw new IllegalArgumentException("缺少协议或主机名");
            }
        } catch (IllegalArgumentException e) {
            throw new StorageException(StorageException.StorageErrorType.CONFIGURATION,
                    "storage.s3.endpoint 不是合法地址（需形如 http://host:9000）：" + properties.getEndpoint(), e);
        }
        if (isBlank(properties.getRegion())) {
            properties.setRegion("us-east-1");
        }
        if (properties.getConnectTimeout() == null) {
            properties.setConnectTimeout(Duration.ofSeconds(5));
        }
        if (properties.getSocketTimeout() == null) {
            properties.setSocketTimeout(Duration.ofSeconds(30));
        }
        return properties;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
