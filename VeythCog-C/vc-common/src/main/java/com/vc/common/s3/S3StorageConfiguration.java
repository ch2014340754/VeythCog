package com.vc.common.s3;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 对象存储装配类。
 *
 * <p>只负责把配置绑成属性、把客户端 / 上传下载客户端 / 预签名工具注册成 Bean，
 * 不注册 Controller、不写鉴权、不碰业务数据库 —— 业务规则留在各业务模块。</p>
 *
 * <p>{@code storage.s3.enabled=false} 时本模块整体不装配；{@code vc-app} 的
 * {@code scanBasePackages=com.vc} 会自动发现本配置类。</p>
 */
@Configuration
@EnableConfigurationProperties(S3Properties.class)
@ConditionalOnProperty(prefix = "storage.s3", name = "enabled", havingValue = "true", matchIfMissing = true)
public class S3StorageConfiguration {

    /**
     * 客户端持有者：懒加载，配置缺失不会阻断应用启动。
     * 实现 {@link AutoCloseable}，容器关闭时 Spring 自动调用 close() 释放连接。
     */
    @Bean
    public S3ClientProvider s3ClientProvider(S3Properties properties) {
        return new S3ClientProvider(properties);
    }

    /** 通用对象操作客户端（上传 / 删除 / 存在性判断） */
    @Bean
    public S3StorageClient s3StorageClient(S3ClientProvider provider) {
        return new S3StorageClient(provider);
    }

    /** 预签名工具（直传 / 下载 URL） */
    @Bean
    public S3PresignService s3PresignService(S3ClientProvider provider, S3Properties properties) {
        return new S3PresignService(provider, properties);
    }
}
