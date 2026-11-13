package com.vc.admin.monitor.web;

import com.vc.admin.monitor.MetricsCollector;
import com.vc.admin.monitor.ResourceMonitor;
import com.vc.admin.monitor.dto.MonitorDtos;
import com.vc.admin.monitor.service.MonitorQueryService;
import com.vc.admin.monitor.service.SessionService;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 系统监控接口（管理域）。
 *
 * <p>全部挂在 /admin 前缀下，由 SecurityConfig 统一要求 ADMIN 角色，无需额外鉴权代码。</p>
 */
@RestController
@RequestMapping("/admin/monitor")
public class AdminMonitorController {

    @Resource
    private MonitorQueryService queryService;

    @Resource
    private SessionService sessionService;

    @Resource
    private ResourceMonitor resourceMonitor;

    @Resource
    private MetricsCollector metricsCollector;

    /** 概览卡片：调用量 / 错误率 / P95 / token / 活跃用户 / 在线会话 */
    @GetMapping("/overview")
    public BaseResponse<MonitorDtos.Overview> overview(
            @RequestParam(defaultValue = "24") int hours) {
        return ResultUtils.success(queryService.overview(hours));
    }

    /** 趋势：24h 内按小时、超过 24h 按天 */
    @GetMapping("/timeseries")
    public BaseResponse<List<MonitorDtos.Point>> timeseries(
            @RequestParam(defaultValue = "24") int hours) {
        return ResultUtils.success(queryService.timeseries(hours));
    }

    /** 接口排行：calls / errors / p95 / cost */
    @GetMapping("/endpoints")
    public BaseResponse<List<MonitorDtos.Endpoint>> endpoints(
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "calls") String sort,
            @RequestParam(defaultValue = "20") int limit) {
        return ResultUtils.success(queryService.endpoints(hours, sort, limit));
    }

    /** 最近错误（业务码非 0 或 HTTP >= 400） */
    @GetMapping("/errors")
    public BaseResponse<List<MonitorDtos.ErrorItem>> errors(
            @RequestParam(defaultValue = "24") int hours,
            @RequestParam(defaultValue = "50") int limit) {
        return ResultUtils.success(queryService.errors(hours, limit));
    }

    /** LLM 用量：按供应商 + 模型聚合 */
    @GetMapping("/llm")
    public BaseResponse<MonitorDtos.LlmSummary> llm(
            @RequestParam(defaultValue = "24") int hours) {
        return ResultUtils.success(queryService.llm(hours));
    }

    /** 在线会话列表 */
    @GetMapping("/sessions")
    public BaseResponse<List<MonitorDtos.SessionItem>> sessions() {
        return ResultUtils.success(queryService.sessions());
    }

    /** 强制下线：置 kicked，下一次请求即 401 */
    @PostMapping("/sessions/{sid}/kick")
    public BaseResponse<Boolean> kick(@PathVariable String sid, java.security.Principal principal) {
        boolean kicked = sessionService.kick(sid, principalUserId(principal));
        if (!kicked) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "会话不存在或已下线");
        }
        return ResultUtils.success(true);
    }

    /** 服务资源占用：CPU / 内存 / Swap / JVM / 线程 / 磁盘 */
    @GetMapping("/resources")
    public BaseResponse<MonitorDtos.Resource> resources() {
        return ResultUtils.success(resourceMonitor.snapshot());
    }

    /** 采集器自身状态：队列水位、丢弃数，用于判断监控是否拖累服务 */
    @GetMapping("/status")
    public BaseResponse<Map<String, Object>> status() {
        return ResultUtils.success(metricsCollector.stats());
    }

    private Long principalUserId(java.security.Principal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        try {
            return Long.valueOf(principal.getName());
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
    }
}
