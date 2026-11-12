package com.vc.nav.dto;

/**
 * 书签图标解析结果。
 *
 * @param type  auto / upload / text
 * @param url   S3 公开直链；文字图标或尚未同步时为 null
 * @param text  文字图标内容
 * @param color 文字图标底色
 */
public record NavIconView(String type, String url, String text, String color) {
}
