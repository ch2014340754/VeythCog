package com.vc.nav.dto;

/**
 * 图标抓取 / 上传结果：拿到 key 后由前端保存时绑定到书签。
 *
 * @param iconKey   public-icons 对象 key
 * @param iconUrl   S3 公开直链（弹窗预览用）
 * @param title     从站点 HTML 解析出的标题（可为 null）
 * @param sourceUrl 实际取到图标的地址（排障用，可为 null）
 */
public record IconUploadResult(String iconKey, String iconUrl, String title, String sourceUrl) {
}
