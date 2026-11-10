package com.vc.common.s3;

import lombok.Getter;

/**
 * 桶定义枚举：桶名只在这里维护，业务层禁止直接写桶名字符串。
 *
 * <p>桶的创建与访问策略（匿名可读 / 私有）由运维在 RustFS 控制台或初始化脚本配置，
 * 代码只描述"这个桶是什么语义"，不逐对象设置 ACL —— S3 ACL 语义在 MinIO 兼容实现上
 * 行为不一致，靠桶级策略更可靠。</p>
 */
@Getter
public enum S3Bucket {

    /** 网页图标：公开只读桶，匿名可读（前端可直接用对象直链加载） */
    PUBLIC_ICONS("public-icons", true, "网页图标，公开只读"),

    /** 壁纸资源：私有桶，不允许匿名访问，只能通过后端预签名 URL 读写 */
    WALLPAPERS("wallpapers", false, "壁纸资源，私有读写");

    /** 实际桶名 */
    private final String bucketName;

    /** 是否允许匿名读取（true 时可直接生成对象直链） */
    private final boolean anonymousReadable;

    /** 语义说明 */
    private final String description;

    S3Bucket(String bucketName, boolean anonymousReadable, String description) {
        this.bucketName = bucketName;
        this.anonymousReadable = anonymousReadable;
        this.description = description;
    }

    /**
     * 按桶名反查枚举。
     *
     * @param bucketName 桶名，忽略大小写
     * @return 匹配的枚举
     * @throws IllegalArgumentException 桶名不在枚举内（属于配置/代码错误，不做静默兜底）
     */
    public static S3Bucket fromName(String bucketName) {
        if (bucketName != null) {
            for (S3Bucket bucket : values()) {
                if (bucket.bucketName.equalsIgnoreCase(bucketName.trim())) {
                    return bucket;
                }
            }
        }
        throw new IllegalArgumentException("未定义的桶名：" + bucketName + "，请在 S3Bucket 枚举中登记");
    }
}
