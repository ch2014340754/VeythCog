package com.vc.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.mybatis.spring.annotation.MapperScan;

/**
 * 唯一可运行应用（装配层）。
 * <p>scanBasePackages / EnableJpaRepositories / EntityScan 均指向 {@code com.vc}，
 * 保证各域模块（vc-common / vc-llm / vc-chat / vc-knowledge）里的 @Component 与 JPA 仓库、实体
 * 都能被装配到同一 Spring 上下文。</p>
 */
@SpringBootApplication(scanBasePackages = "com.vc")
@EnableJpaRepositories(basePackages = "com.vc")
@EntityScan(basePackages = "com.vc")
@MapperScan({"com.vc.knowledge.mapper", "com.vc.chat.mapper"})
public class VcAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(VcAppApplication.class, args);
    }

}
