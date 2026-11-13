package com.vc.admin.monitor.service;

import com.vc.admin.monitor.entity.UserSession;
import com.vc.admin.monitor.repository.UserSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 登录会话服务：创建（登录）/ 校验（每次鉴权）/ 心跳（节流写库）/ 登出 / 强制下线。
 *
 * <p>为什么要节流：JWT 鉴权在每个请求上跑，如果每个请求都 update last_active_at，
 * 会把读多写少的接口变成写热点。这里同一会话 20 秒内只落库一次，
 * 在线判断（5 分钟窗口）因此最多有 20 秒误差，可接受。</p>
 */
@Slf4j
@Service
public class SessionService {

    /** 同一会话两次活跃时间写入的最小间隔 */
    private static final long TOUCH_INTERVAL_MS = 20_000L;

    private final UserSessionRepository repository;
    private final JdbcTemplate jdbc;
    /** sid -> 上次落库时间戳，避免高并发下反复写库；超过阈值自动清理 */
    private final Map<String, Long> lastTouch = new ConcurrentHashMap<>();

    public SessionService(UserSessionRepository repository, JdbcTemplate jdbc) {
        this.repository = repository;
        this.jdbc = jdbc;
    }

    /** 登录成功后创建会话，返回 sid（写进 JWT） */
    public String create(Long userId, String username, String ip, String userAgent) {
        LocalDateTime now = LocalDateTime.now();
        UserSession session = new UserSession();
        session.setSid(UUID.randomUUID().toString());
        session.setUserId(userId);
        session.setUsername(username);
        session.setIp(truncate(ip, 64));
        session.setUserAgent(truncate(userAgent, 300));
        session.setLoginAt(now);
        session.setLastActiveAt(now);
        session.setStatus("active");
        repository.save(session);
        return session.getSid();
    }

    /** 会话是否仍然有效（被踢 / 登出后返回 false，JWT 随即失效） */
    public boolean isActive(String sid) {
        return sid != null && !sid.isBlank() && repository.existsBySidAndStatus(sid, "active");
    }

    /** 刷新活跃时间（节流），用于「在线会话」判定 */
    public void touch(String sid) {
        if (sid == null || sid.isBlank()) {
            return;
        }
        long now = System.currentTimeMillis();
        Long last = lastTouch.get(sid);
        if (last != null && now - last < TOUCH_INTERVAL_MS) {
            return;
        }
        lastTouch.put(sid, now);
        if (lastTouch.size() > 5000) {
            lastTouch.clear();
        }
        try {
            jdbc.update("UPDATE sys_user_session SET last_active_at = now() WHERE sid = ? AND status = 'active'", sid);
        } catch (Exception e) {
            // 心跳失败不影响业务请求
            log.debug("[monitor] 会话心跳失败 sid={}: {}", sid, e.getMessage());
        }
    }

    /** 主动登出：只影响当前会话，其他设备登录态不受影响 */
    public void logout(String sid) {
        if (sid == null || sid.isBlank()) {
            return;
        }
        lastTouch.remove(sid);
        jdbc.update("UPDATE sys_user_session SET status = 'logout' WHERE sid = ? AND status = 'active'", sid);
    }

    /** 强制下线：置 kicked，下一次请求即 401 */
    public boolean kick(String sid, Long adminUserId) {
        int rows = jdbc.update("""
                UPDATE sys_user_session
                   SET status = 'kicked', kicked_at = now(), kicked_by = ?
                 WHERE sid = ? AND status = 'active'
                """, adminUserId, sid);
        lastTouch.remove(sid);
        return rows > 0;
    }

    /** 长期不活跃自动过期（保留期由定时任务调用） */
    public int expireIdle(int days) {
        return jdbc.update("""
                UPDATE sys_user_session
                   SET status = 'expired'
                 WHERE status = 'active'
                   AND last_active_at < now() - make_interval(days => ?)
                """, days);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
