package com.vc.vcchat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.vc")
public class VcChatApplication {

    public static void main(String[] args) {
        SpringApplication.run(VcChatApplication.class, args);
    }

}
