# =============================================================================
# 后端镜像 · 多阶段构建
# -----------------------------------------------------------------------------
# 后端唯一可运行应用为 vc-app，依赖 vc-common / vc-llm / vc-chat / vc-knowledge。
# 技术栈：Java 21 + Spring Boot 3.5 + Maven 多模块（聚合根 pom）。
#
# 构建上下文须为「项目根目录」（fly.toml 与本文件同目录，从根目录部署），
# 至少包含：pom.xml + vc-common / vc-llm / vc-chat / vc-knowledge / vc-app。
#   vc-learn（学习沙箱）无需进入生产构建上下文，本 Dockerfile 不引用它。
#
# 构建要点：
#   根 pom.xml 的 <modules> 引用了 vc-learn；若用聚合 reactor（-pl vc-app -am），
#   Maven 必须读到 vc-learn/pom.xml，缺它即构建失败。
#   因此改用「-f <模块>/pom.xml」逐个构建：根 pom 仅作为 parent 解析，
#   不触发聚合 modules 遍历，从而彻底摆脱对 vc-learn 的依赖。
# =============================================================================

# ---------- 阶段 1：编译打包 ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# 国内 Maven 依赖加速：用阿里云镜像覆盖官方 global settings（只镜像 central，milestone 仓库仍直连）
COPY maven-settings.xml /usr/share/maven/conf/settings.xml

# 1) 复制根 pom 与生产模块 pom（不含 vc-learn）
COPY pom.xml .
COPY vc-common/pom.xml      vc-common/
COPY vc-llm/pom.xml         vc-llm/
COPY vc-chat/pom.xml        vc-chat/
COPY vc-knowledge/pom.xml   vc-knowledge/
COPY vc-app/pom.xml         vc-app/

# 2) 复制生产模块源码（vc-learn 不需要）
COPY vc-common      vc-common
COPY vc-llm         vc-llm
COPY vc-chat        vc-chat
COPY vc-knowledge   vc-knowledge
COPY vc-app         vc-app

# 3) 按依赖拓扑逐个构建并安装到本地仓库，最后打包 vc-app：
#    vc-common → vc-llm → vc-knowledge → vc-chat → vc-app
#    （逐个 -f 构建，避免聚合 reactor 对 vc-learn 的依赖）
#    先 install -N 根聚合 pom：子模块 pom 的 parent 是根 pom，解析依赖时
#    必须在本地仓库找到它，否则报 "Could not find artifact com.vc:veythcog-c:pom"
#    --mount=type=cache,target=/root/.m2：把 Maven 依赖仓库做成宿主级持久缓存，
#    源码改动触发本层重建时不再重复下载依赖（需 BuildKit，现代 Docker/Podman 默认支持）
RUN --mount=type=cache,target=/root/.m2 \
    mvn -q -B -f pom.xml install -N -DskipTests \
 && mvn -q -B -f vc-common/pom.xml    install -DskipTests \
 && mvn -q -B -f vc-llm/pom.xml       install -DskipTests \
 && mvn -q -B -f vc-knowledge/pom.xml install -DskipTests \
 && mvn -q -B -f vc-chat/pom.xml      install -DskipTests \
 && mvn -q -B -f vc-nav/pom.xml       install -DskipTests \
 && mvn -q -B -f vc-app/pom.xml       package -DskipTests

# ---------- 阶段 2：精简运行镜像 ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# 非 root 运行（安全最佳实践）
RUN useradd --system --create-home --uid 10001 vcapp \
    && mkdir -p /app && chown -R vcapp:vcapp /app
USER vcapp

COPY --from=build /workspace/vc-app/target/*.jar app.jar

# 服务端口：见 application.yml（server.port: 8123，context-path: /api）
EXPOSE 8123

# 运行期可覆盖的 JVM 参数（如 -Xms512m -Xmx1024m）
ENV JAVA_OPTS=""

# 关键外部配置统一经环境变量注入（优先级：compose environment > 镜像 ENV 默认值）：
#   · 数据源默认值指向「本机 PostgreSQL」（与腾讯轻量服务器部署一致：veyth_cog / postgres / 123456）；
#     compose 里用 SPRING_DATASOURCE_URL 覆盖为 pg-vector:5432（同网络下走容器名，见 DEPLOY.md）
#   · API Key：DASHSCOPE_API_KEY / DEEPSEEK_API_KEY 须在运行时提供（参考 .env.example）
#   · 注意：切勿在镜像内写死云数据库凭据（历史坑：曾内置 Supabase 明文账号密码），一律运行时注入
ENV SPRING_PROFILES_ACTIVE=prod \
    SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/veyth_cog \
    SPRING_DATASOURCE_USERNAME=postgres \
    SPRING_DATASOURCE_PASSWORD=123456 \
    SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
