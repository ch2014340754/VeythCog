package com.vc.knowledge.clip.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.clip.config.ClipProperties;
import com.vc.knowledge.clip.dto.ClipTokenCreateResult;
import com.vc.knowledge.clip.dto.ClipTokenView;
import com.vc.knowledge.clip.entity.ClipToken;
import com.vc.knowledge.clip.mapper.ClipTokenMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 剪藏令牌服务：签发 / 列表 / 撤销 / 校验 + 频控。
 *
 * <p>令牌是<b>只可写</b>的长期凭据：只允许调用 {@code POST /clip/capture}，
 * 不能读列表、不能删改。库里只存 SHA-256，明文只在签发时返回一次。</p>
 */
@Service
public class ClipTokenService {

    private static final Logger log = LoggerFactory.getLogger(ClipTokenService.class);

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 令牌前缀，便于在日志/代码里一眼认出，也降低"用户误把 JWT 填进去"的概率 */
    private static final String PREFIX = "vck_";

    private final ClipTokenMapper tokenMapper;
    private final ClipProperties properties;

    /** 令牌维度频控窗口：hash → [窗口起点毫秒, 次数] */
    private final Map<String, long[]> rateWindow = new ConcurrentHashMap<>();

    public ClipTokenService(ClipTokenMapper tokenMapper, ClipProperties properties) {
        this.tokenMapper = tokenMapper;
        this.properties = properties;
    }

    /** 签发新令牌；同一账号可有多条（不同设备不同书签），默认标签便于区分 */
    @Transactional
    public ClipTokenCreateResult create(Long userId, String label, String apiBase) {
        String plain = PREFIX + randomHex(32);
        ClipToken token = new ClipToken();
        token.setOwnerId(userId);
        token.setTokenHash(sha256(plain));
        token.setLabel(label == null || label.isBlank() ? "默认书签" : label.trim());
        token.setRevoked(false);
        token.setCreatedAt(OffsetDateTime.now());
        tokenMapper.insert(token);

        ClipTokenCreateResult result = new ClipTokenCreateResult();
        result.setId(token.getId());
        result.setLabel(token.getLabel());
        result.setToken(plain);
        result.setBookmarklet(buildBookmarklet(plain, apiBase));
        result.setCreatedAt(token.getCreatedAt().toEpochSecond() * 1000);
        log.info("签发剪藏令牌: userId={}, id={}", userId, token.getId());
        return result;
    }

    /**
     * 书签脚本：在原页面抓 DOM → POST /clip/capture（text/plain 简单请求，不触发预检）→ 页面内 toast 反馈。
     * <p>令牌与后端地址直接拼进脚本，所以明文只在签发时能生成，重置后需重新拖一次书签。</p>
     */
    private String buildBookmarklet(String plainToken, String apiBase) {
        String base = apiBase == null || apiBase.isBlank() ? properties.getPublicApiBase() : apiBase.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return "javascript:(function(){"
                + "var d=document,u=location.href,"
                + "h=((d.querySelector('article')||d.querySelector('main')||d.body||{}).innerHTML||''),"
                + "t=(d.title||'').slice(0,300),"
                + "x=((d.body&&d.body.innerText)||'').slice(0,500);"
                + "if(h.length>1800000){h=h.slice(0,1800000)}"
                + "fetch('" + base + "/clip/capture?token=" + plainToken + "',"
                + "{method:'POST',headers:{'Content-Type':'text/plain'},"
                + "body:JSON.stringify({url:u,title:t,html:h,excerpt:x})})"
                + ".then(function(r){return r.json()}).then(function(j){"
                + "var ok=!!(j&&j.code===0);"
                + "toast(ok?'已收进渡思':('剪藏失败：'+((j&&j.message)||'未知错误')),ok);"
                + "}).catch(function(){toast('剪藏失败：网络错误',false)});"
                + "function toast(m,ok){var s=d.createElement('div');s.textContent=m;"
                + "s.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:10px 16px;"
                + "border-radius:10px;font:14px/1.4 system-ui,sans-serif;color:#fff;"
                + "box-shadow:0 8px 24px rgba(0,0,0,.35);background:'+"
                + "(ok?'rgba(30,27,75,.92)':'rgba(220,38,38,.92)');"
                + "d.body.appendChild(s);setTimeout(function(){s.remove()},2200);}"
                + "})();";
    }

    public List<ClipTokenView> list(Long userId) {
        List<ClipToken> tokens = tokenMapper.selectList(new LambdaQueryWrapper<ClipToken>()
                .eq(ClipToken::getOwnerId, userId)
                .orderByDesc(ClipToken::getCreatedAt));
        List<ClipTokenView> views = new ArrayList<>(tokens.size());
        for (ClipToken token : tokens) {
            ClipTokenView view = new ClipTokenView();
            view.setId(token.getId());
            view.setLabel(token.getLabel());
            view.setRevoked(token.getRevoked());
            view.setCreatedAt(token.getCreatedAt() == null ? null : token.getCreatedAt().toEpochSecond() * 1000);
            view.setLastUsedAt(token.getLastUsedAt() == null ? null : token.getLastUsedAt().toEpochSecond() * 1000);
            views.add(view);
        }
        return views;
    }

    @Transactional
    public void revoke(Long userId, Long id) {
        ClipToken token = tokenMapper.selectById(id);
        if (token == null || !token.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "令牌不存在");
        }
        token.setRevoked(true);
        tokenMapper.updateById(token);
        log.info("撤销剪藏令牌: userId={}, id={}", userId, id);
    }

    /**
     * 校验令牌并返回归属账号；同时做令牌维度频控。
     *
     * @throws BusinessException 40100 令牌无效 / 42900 频控超限
     */
    @Transactional
    public Long authenticate(String plainToken) {
        if (plainToken == null || plainToken.isBlank()) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "缺少剪藏令牌");
        }
        String hash = sha256(plainToken.trim());
        ClipToken token = tokenMapper.selectOne(new LambdaQueryWrapper<ClipToken>()
                .eq(ClipToken::getTokenHash, hash)
                .eq(ClipToken::getRevoked, false)
                .last("limit 1"));
        if (token == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "剪藏令牌无效或已撤销");
        }
        checkRate(hash);
        token.setLastUsedAt(OffsetDateTime.now());
        tokenMapper.updateById(token);
        return token.getOwnerId();
    }

    /** 同令牌每分钟次数上限 */
    private void checkRate(String hash) {
        int limit = Math.max(1, properties.getTokenRatePerMinute());
        long now = System.currentTimeMillis();
        long windowMs = 60_000L;
        long[] window = rateWindow.compute(hash, (key, existing) -> {
            if (existing == null || now - existing[0] >= windowMs) {
                return new long[]{now, 1L};
            }
            existing[1] = existing[1] + 1;
            return existing;
        });
        if (window[1] > limit) {
            throw new BusinessException(ErrorCode.RATE_LIMIT_ERROR,
                    "剪藏太频繁（每分钟上限 " + limit + " 条），请稍后再试");
        }
        // 简单清理，避免 map 无上限增长
        if (rateWindow.size() > 5000) {
            rateWindow.entrySet().removeIf(entry -> now - entry.getValue()[0] > windowMs);
        }
    }

    private String randomHex(int bytes) {
        byte[] buffer = new byte[bytes];
        RANDOM.nextBytes(buffer);
        return toHex(buffer);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return toHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
