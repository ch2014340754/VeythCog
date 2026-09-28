package com.vc.learn;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring AI 学习沙箱入口。
 * <p>独立模块，只依赖阿里百炼（DashScope），与业务模块（vc-common/llm/chat/knowledge/app）零依赖。
 * 启动前设置 DASHSCOPE_API_KEY（或写入本地 application-local.yml），随后 ChatDemo 会自动完成一次真实调用。</p>
 */
@SpringBootApplication
public class VcLearnApplication {

    public static void main(String[] args) {
        SpringApplication.run(VcLearnApplication.class, args);
    }

}
