package com.vc.music.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3Bucket;
import com.vc.common.s3.S3ClientProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.util.Locale;

/**
 * 音频播流服务：由后端代理 S3 私有桶，按浏览器 Range 请求返回 206。
 *
 * <p><b>为什么不把预签名地址直接交给 {@code <audio>}：</b>
 * 对象存储在带 Range 的预签名请求上会重置连接，而音频拖动进度条高度依赖 Range
 * （{@code DEPLOY.md} 坑 18 与 {@code NavWallpaperService} 注释都记录过这个问题）。
 * 因此音频与动态壁纸走同一套代理模式。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicStreamService {

    private final S3ClientProvider clientProvider;

    /**
     * 代理流。
     *
     * @param stream      S3 响应流，调用方负责关闭
     * @param contentType Content-Type（缺失时按后缀兜底）
     * @param totalLength 对象总字节数
     * @param start       本次返回的起始字节（含）
     * @param end         本次返回的结束字节（含）
     */
    public record AudioStream(ResponseInputStream<GetObjectResponse> stream, String contentType,
                              long totalLength, long start, long end) {

        public long length() {
            return end - start + 1;
        }

        public boolean partial() {
            return start > 0 || end < totalLength - 1;
        }
    }

    public AudioStream stream(String objectKey, String rangeHeader) {
        if (objectKey == null || objectKey.isBlank() || objectKey.contains("..")) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "音频对象不存在");
        }
        try {
            S3Client client = clientProvider.getS3Client();
            HeadObjectResponse meta = client.headObject(HeadObjectRequest.builder()
                    .bucket(S3Bucket.MUSIC.getBucketName())
                    .key(objectKey)
                    .build());
            long total = meta.contentLength();
            if (total <= 0) {
                throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "音频对象不存在或已删除");
            }
            String contentType = meta.contentType();
            if (contentType == null || contentType.isBlank()) {
                contentType = guessContentType(objectKey);
            }
            long[] range = parseRange(rangeHeader, total);
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(S3Bucket.MUSIC.getBucketName())
                    .key(objectKey)
                    .range("bytes=" + range[0] + "-" + range[1])
                    .build();
            ResponseInputStream<GetObjectResponse> stream = client.getObject(request);
            return new AudioStream(stream, contentType, total, range[0], range[1]);
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "音频对象不存在或已删除");
            }
            log.warn("读取音频对象失败 key={}：{}", objectKey, e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "音频读取失败");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("代理音频失败 key={}：{}", objectKey, e.getMessage());
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "音频读取失败");
        }
    }

    /**
     * 解析单段 Range（bytes=start-end / bytes=start- / bytes=-suffix）。
     * 非法或越界时退回整段，绝不返回 416（浏览器对 416 的处理比整段重下更糟）。
     */
    static long[] parseRange(String header, long total) {
        long[] full = new long[]{0, total - 1};
        if (header == null || header.isBlank() || !header.startsWith("bytes=")) {
            return full;
        }
        String spec = header.substring(6).split(",")[0].trim();
        int dash = spec.indexOf('-');
        if (dash < 0) {
            return full;
        }
        try {
            String startText = spec.substring(0, dash).trim();
            String endText = spec.substring(dash + 1).trim();
            long start;
            long end;
            if (startText.isEmpty()) {
                long suffix = Long.parseLong(endText);
                if (suffix <= 0) {
                    return full;
                }
                start = Math.max(0, total - suffix);
                end = total - 1;
            } else {
                start = Long.parseLong(startText);
                end = endText.isEmpty() ? total - 1 : Math.min(Long.parseLong(endText), total - 1);
            }
            if (start < 0 || start >= total || start > end) {
                return full;
            }
            return new long[]{start, end};
        } catch (NumberFormatException e) {
            return full;
        }
    }

    private static String guessContentType(String key) {
        String lower = key.toLowerCase(Locale.ROOT);
        return lower.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
    }
}
