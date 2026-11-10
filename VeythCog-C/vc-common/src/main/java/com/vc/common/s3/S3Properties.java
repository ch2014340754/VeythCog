package com.vc.common.s3;

import java.time.Duration;

import lombok.Data;
import lombok.ToString;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 对象存储（S3 协议）配置，前缀 {@code storage.s3}。
 *
 * <p>当前接入 RustFS（S3 协议完全兼容 MinIO），后续换 MinIO / 阿里 OSS / AWS S3
 * 只需改本配置的 endpoint 与密钥，业务代码无需改动。</p>
 *
 * <p>安全约束：access-key / secret-key 只允许来自配置文件（application-local.yml 已 gitignore）
 * 或环境变量，代码中不得硬编码；两者也不会出现在 {@code toString()} 日志里。</p>
 *
 * <p>示例：</p>
 * <pre>
 * storage:
 *   s3:
 *     endpoint: ${RUSTFS_ENDPOINT:http://localhost:9000}
 *     access-key: ${RUSTFS_ACCESS_KEY:}
 *     secret-key: ${RUSTFS_SECRET_KEY:}
 *     region: us-east-1
 *     path-style-access: true
 *     presign-expiry: 15m
 * </pre>
 */
@Data
@ConfigurationProperties(prefix = "storage.s3")
public class S3Properties {

    /** 是否装配存储能力；关闭后不注册本模块任何 Bean */
    private boolean enabled = true;

    /** 服务地址，必须带协议，例如 http://rustfs:9000（自建 S3 一律走 pathStyle，不要填 CDN 域名） */
    private String endpoint;

    /**
     * 对外可访问的服务地址，只用于<b>生成</b>预签名 URL 与公开直链，不用于后端发起请求。
     *
     * <p>为什么需要它：{@code endpoint} 是容器内网地址（如 {@code http://rustfs:9000}），
     * 用它签出来的 URL 主机名是 {@code rustfs}，公网浏览器根本解析不了，图片/附件必然加载失败。
     * SigV4 签名把 Host 算进了 canonical request，所以不能「签内网地址、让浏览器换成公网域名访问」——
     * 必须直接用公网地址签。</p>
     *
     * <p>示例：{@code https://api.veythcog.top}（Nginx 把桶名路径原样反代到 RustFS），
     * 或独立子域名 {@code https://s3.veythcog.top}。留空则沿用 {@code endpoint}（仅适合纯内网/本地）。</p>
     */
    private String publicEndpoint;

    /** 访问密钥 ID（禁止硬编码，走配置或环境变量） */
    @ToString.Exclude
    private String accessKey;

    /** 访问密钥 Secret（禁止硬编码，走配置或环境变量） */
    @ToString.Exclude
    private String secretKey;

    /** 区域：RustFS / MinIO 只用于 SigV4 签名计算，任意合法值均可，默认 us-east-1 */
    private String region = "us-east-1";

    /**
     * 是否启用 pathStyle 访问（{@code http://host:port/bucket/key}）。
     * RustFS / MinIO 必须为 true；AWS S3 / 阿里 OSS 等虚拟主机风格可改为 false。
     */
    private boolean pathStyleAccess = true;

    /** 预签名 URL 默认有效期，未显式传入时使用；S3 SigV4 上限 7 天 */
    private Duration presignExpiry = Duration.ofMinutes(15);

    /** 建立连接超时 */
    private Duration connectTimeout = Duration.ofSeconds(5);

    /** 读取超时（大文件上传需按体积适当放大） */
    private Duration socketTimeout = Duration.ofSeconds(30);
}
