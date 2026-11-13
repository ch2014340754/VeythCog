package com.vc.admin.monitor;

import com.vc.admin.monitor.dto.MonitorDtos;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.RuntimeMXBean;
import java.lang.management.ThreadMXBean;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 服务资源占用：进程 CPU / 系统 CPU / 物理内存与 Swap / JVM 堆 / 线程数 / 磁盘。
 *
 * <p>全部走 JDK 自带 MXBean，不需要 Micrometer / Prometheus / 额外 agent，
 * 与「单机部署、无 Redis / 无监控栈」的现状匹配。拿不到的值统一返回 -1，
 * 前端显示「—」而不是假装 0。</p>
 */
@Slf4j
@Component
public class ResourceMonitor {

    private static final DateTimeFormatter TIME_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    public MonitorDtos.Resource snapshot() {
        var os = ManagementFactory.getOperatingSystemMXBean();
        double systemCpuLoad = -1;
        double processCpuLoad = -1;
        long memoryTotal = -1;
        long memoryUsed = -1;
        long swapTotal = -1;
        long swapUsed = -1;

        if (os instanceof com.sun.management.OperatingSystemMXBean sun) {
            try {
                systemCpuLoad = sun.getCpuLoad();
                processCpuLoad = sun.getProcessCpuLoad();
                memoryTotal = sun.getTotalMemorySize();
                long free = sun.getFreeMemorySize();
                memoryUsed = memoryTotal - free;
                swapTotal = sun.getTotalSwapSpaceSize();
                swapUsed = swapTotal - sun.getFreeSwapSpaceSize();
            } catch (RuntimeException e) {
                log.debug("[monitor] 操作系统指标不可用: {}", e.getMessage());
            }
        }

        MemoryMXBean memory = ManagementFactory.getMemoryMXBean();
        MemoryUsage heap = memory.getHeapMemoryUsage();
        MemoryUsage nonHeap = memory.getNonHeapMemoryUsage();
        ThreadMXBean threads = ManagementFactory.getThreadMXBean();
        RuntimeMXBean runtime = ManagementFactory.getRuntimeMXBean();

        String diskPath = "-";
        long diskTotal = -1;
        long diskUsable = -1;
        long diskUsed = -1;
        try {
            Path path = Paths.get(System.getProperty("user.dir", "."));
            diskPath = path.toAbsolutePath().toString();
            FileStore store = Files.getFileStore(path);
            diskTotal = store.getTotalSpace();
            diskUsable = store.getUsableSpace();
            diskUsed = diskTotal - diskUsable;
        } catch (Exception e) {
            // Windows 上某些虚拟盘可能读不到，保留 -1
            log.debug("[monitor] 磁盘指标不可用: {}", e.getMessage());
            diskPath = new File(".").getAbsolutePath();
        }

        return new MonitorDtos.Resource(
                os.getName(),
                os.getVersion(),
                os.getAvailableProcessors(),
                round2(systemCpuLoad),
                round2(processCpuLoad),
                os.getSystemLoadAverage(),
                memoryTotal,
                memoryUsed,
                swapTotal,
                swapUsed,
                heap.getUsed(),
                heap.getMax() < 0 ? -1 : heap.getMax(),
                heap.getCommitted(),
                nonHeap.getUsed(),
                threads.getThreadCount(),
                runtime.getUptime(),
                TIME_FORMAT.format(Instant.ofEpochMilli(runtime.getStartTime())),
                diskPath,
                diskTotal,
                diskUsable,
                diskUsed,
                TIME_FORMAT.format(Instant.now()));
    }

    private static double round2(double value) {
        if (value < 0) {
            return -1;
        }
        return Math.round(value * 100d) / 100d;
    }
}
