# =============================================================================
# vc-app 后端镜像 · 多阶段构建
# -----------------------------------------------------------------------------
# 后端唯一可运行应用为 vc-app，依赖 vc-common / vc-llm / vc-chat / vc-knowledge。
# 技术栈：Java 21 + Spring Boot 3.5 + Maven 多模块（聚合根 pom）。
#
# 构建上下文必须为「项目根目录」（需含父 pom 与全部模块）：
#     docker build -f vc-app/Dockerfile -t veythcog/vc-app .
#
# 关键注意：
#   根 pom.xml 的 <modules> 包含 vc-learn，Maven reactor 必须能读到
#   vc-learn/pom.xml，否则即使 -pl vc-app 也会因缺少模块而构建失败。
#   （现有根目录 Dockerfile 未 COPY vc-learn，存在该缺陷。）
# =============================================================================

# ---------- 阶段 1：编译打包 ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# 1) 先复制全部 pom 以拉取依赖（利用 Docker 层缓存）
COPY pom.xml .
COPY vc-common/pom.xml      vc-common/
COPY vc-llm/pom.xml         vc-llm/
COPY vc-chat/pom.xml        vc-chat/
COPY vc-knowledge/pom.xml   vc-knowledge/
COPY vc-app/pom.xml         vc-app/
COPY vc-learn/pom.xml       vc-learn/
RUN mvn -q -B dependency:go-offline

# 2) 复制源码（vc-learn 为学习沙箱，不参与生产打包，仅保证 reactor 完整）
COPY vc-common      vc-common
COPY vc-llm         vc-llm
COPY vc-chat        vc-chat
COPY vc-knowledge   vc-knowledge
COPY vc-app         vc-app
COPY vc-learn       vc-learn

# 3) 打包 vc-app 及其依赖模块（-am：连同上游模块一起构建），跳过测试
RUN mvn -q -B -pl vc-app -am package -DskipTests

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

# 关键外部配置统一经环境变量注入（优先级高于 application-local.yml）：
#   · 数据源：指向 PostgreSQL（与 docker-compose.yml 的 postgres 服务对应）
#   · API Key：DASHSCOPE_API_KEY / DEEPSEEK_API_KEY 须在运行时提供（参考 .env.example）
ENV SPRING_PROFILES_ACTIVE=prod \
    SPRING_DATASOURCE_URL=jdbc:postgresql://db.vekgjdocbwfbzvdpzhuq.supabase.co:5432/postgres \
    SPRING_DATASOURCE_USERNAME=postgres \
    SPRING_DATASOURCE_PASSWORD=nORAsQwRmY5Xi4yg \
    SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
