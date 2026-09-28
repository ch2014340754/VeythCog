# 多阶段构建：先编译打包，再产出精简运行镜像
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# 先复制 pom 拉取依赖（利用层缓存）。vc-learn 为学习沙箱，不进入生产镜像
COPY pom.xml .
COPY vc-common/pom.xml vc-common/
COPY vc-llm/pom.xml vc-llm/
COPY vc-chat/pom.xml vc-chat/
COPY vc-knowledge/pom.xml vc-knowledge/
COPY vc-app/pom.xml vc-app/
RUN mvn -q -B dependency:go-offline
# 再复制源码并打包 vc-app（含其依赖模块）
COPY vc-common vc-common
COPY vc-llm vc-llm
COPY vc-chat vc-chat
COPY vc-knowledge vc-knowledge
COPY vc-app vc-app
RUN mvn -q -B -pl vc-app -am package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/vc-app/target/*.jar app.jar
EXPOSE 8123
ENTRYPOINT ["java", "-jar", "app.jar"]
