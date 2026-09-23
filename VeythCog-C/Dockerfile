# 多阶段构建：先编译打包，再产出精简运行镜像
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
# 先复制 pom 拉取依赖（利用层缓存）
COPY pom.xml .
COPY vc-code/pom.xml vc-code/
COPY vc-chat/pom.xml vc-chat/
RUN mvn -q -B dependency:go-offline
# 再复制源码并打包
COPY vc-code vc-code
COPY vc-chat vc-chat
RUN mvn -q -B -pl vc-chat -am package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/vc-chat/target/*.jar app.jar
EXPOSE 8123
ENTRYPOINT ["java", "-jar", "app.jar"]
