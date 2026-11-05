# VeythCog渡思｜腾讯轻量宝塔+Docker+pgvector 部署归档文档
> 环境：腾讯轻量云服务器，宝塔Ubuntu系统，Docker Compose编排
> 目标：PG15+pgvector向量库 + pgAdmin4网页管理工具 + VeythCog-C后端服务（SpringAI）

## 一、服务清单 & 访问信息
1. **pg-vector（PostgreSQL15 + pgvector扩展）**
- 镜像：`pgvector/pgvector:pg15`
- 容器名：`pg-vector`
- 容器内部访问地址：`pg-vector:5432`（compose网络内，后端、pgadmin都用这个地址互通）
- 宿主机映射端口：`5432:5432`
- 数据库账号：
  - 用户名：`postgres`
  - 密码：`123456`
  - 默认业务库：`veyth_cog`
- 数据持久化：`./pgdata:/var/lib/postgresql/data`
- 自启动策略：`unless-stopped`（容器异常、服务器重启自动拉起）
- 向量扩展启用SQL（新建库执行一次）
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. **pgAdmin4（网页数据库管理）**
- 镜像：`dpage/pgadmin4:latest`
- 容器名：`pgadmin`
- 宿主机访问地址：`http://服务器公网IP:5050`
- 网页登录账号（和数据库账号分开！重点区分）
  - 邮箱：`admin@veyth.cog`
  - 密码：`Admin@123456`
- 宿主机映射端口：`5050:80`
- 数据持久化：`./pgadmin-data:/var/lib/pgadmin`
- 关键配置：`user: root`（解决挂载目录权限报错`Permission denied`）
- 自启动策略：`unless-stopped`

> ✅ 连通规则：pgadmin添加数据库服务器，主机名填 `pg-vector`，用户名填`postgres`，密码`123456`

3. **VeythCog-C 后端（SpringAI，本次新增）**
- 镜像：`veyth-cog-backend:v1`（本地 podman 构建导出，见第五章）
- 容器名：`veyth-cog-backend`
- 容器内部访问地址：`127.0.0.1:8123`，context-path 为 `/api`
- 宿主机映射端口：`8123:8123`
- 接口文档（swagger/knife4j）：`http://服务器公网IP:8123/api/swagger-ui.html`
- 数据库连接：compose 同网络下写 `jdbc:postgresql://pg-vector:5432/veyth_cog`（**必须用 compose 环境变量覆盖，不能走镜像内置默认值，见踩坑6**）
- 自启动策略：`unless-stopped`

> ⚠️ 容器内以非 root 用户 `vcapp(uid 10001)` 运行，镜像已做安全加固，无需额外处理

## 二、完整 docker-compose.yml（当前可用版本）
```yaml
version: '3.8'
services:
  pg-vector:
    image: pgvector/pgvector:pg15
    container_name: pg-vector
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 123456
      POSTGRES_DB: veyth_cog
    volumes:
      - ./pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d veyth_cog"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    restart: unless-stopped
    user: root
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@veyth.cog
      PGADMIN_DEFAULT_PASSWORD: Admin@123456
    volumes:
      - ./pgadmin-data:/var/lib/pgadmin
    ports:
      - "5050:80"
    depends_on:
      - pg-vector

  # ===== VeythCog-C 后端（本地构建导入的镜像，v1 版本）=====
  backend:
    image: veyth-cog-backend:v1
    container_name: veyth-cog-backend
    restart: unless-stopped
    environment:
      # 数据源必须覆盖为服务器本机的 pg-vector（不能使用镜像内置的 Supabase 默认值，见踩坑6）
      SPRING_DATASOURCE_URL: jdbc:postgresql://pg-vector:5432/veyth_cog
      SPRING_DATASOURCE_USERNAME: postgres
      SPRING_DATASOURCE_PASSWORD: "123456"
      SPRING_DATASOURCE_DRIVER_CLASS_NAME: org.postgresql.Driver
      # AI 供应商 Key（必填，见 .env.example）
      DASHSCOPE_API_KEY: "sk-xxx-填写实际key"
      DASHSCOPE_MODEL: "qwen-plus"        # 无默认值，缺失会导致启动失败（见踩坑7），按百炼可用模型填写
      DEEPSEEK_API_KEY: ""                # 可留空，绑定 DeepSeek 模型时才会用到
      # JWT 密钥（生产务必换成长随机串，勿用默认值）
      JWT_SECRET: "change-me-to-a-long-random-string-0123456789abcdef"
      # JVM 内存限制（轻量服务器建议）
      JAVA_OPTS: "-Xms256m -Xmx512m"
    ports:
      - "8123:8123"
    depends_on:
      - pg-vector
```
- 启动命令：`docker compose up -d`
- 停止命令：`docker compose down`
- 查看日志：`docker logs -f 容器名`

## 三、宝塔 & 腾讯云防火墙配置（必做）
1. 腾讯云轻量控制台防火墙：放行TCP `5432`、`5050`、`8123`
2. 宝塔面板 → 安全 → 防火墙：放行TCP `5432`、`5050`、`8123`
> ⚠️ 安全提醒：5050、5432不建议长期对公网开放；8123 上线后建议改用域名+宝塔Nginx反向代理（见第五章第6步），关闭裸端口

## 四、踩坑记录（重点留存，避免重复踩）
1. ❌ 坑1：pgadmin和PG容器不在同一个Docker网络 → 无法解析`pg-vector`
   ✅ 解决：统一用一份compose编排启动，自动在同一个默认网络，容器DNS互通
2. ❌ 坑2：pgadmin挂载卷报 `/var/lib/pgadmin/sessions` 权限拒绝
   ✅ 解决：compose增加 `user: root` 配置（个人开发环境使用）
3. ❌ 坑3：混淆两套账号，把pgadmin网页账号`admin@xxx`当成PG数据库账号
   ✅ 区分：数据库账号是`postgres`，网页登录账号只是pgadmin自己的登录凭证
4. ❌ 坑4：DBeaver本地SSH隧道连不上、公网直连不稳定
   ✅ 替代方案：优先用pgadmin网页端查询，避开本地客户端网络限制
5. ❌ 坑5：PG18镜像挂载目录结构变更，容易启动失败
   ✅ 选型结论：稳定选用 `pgvector/pgvector:pg15`

6. ❌ 坑6：后端镜像 Dockerfile 内置默认数据源指向 Supabase（历史遗留的云库地址，含明文账号密码）
   ✅ 解决：compose 环境变量优先级高于镜像 ENV 默认值，必须显式覆盖为 `pg-vector:5432/veyth_cog`；同时提醒：镜像内凭据仅作兜底默认，正式环境一律运行时注入，仓库后续可把该 ENV 从 Dockerfile 移除
7. ❌ 坑7：`DASHSCOPE_MODEL` 在 application.yml 中是 `${DASHSCOPE_MODEL}`（无默认值），不传会导致启动阶段占位符解析失败
   ✅ 解决：compose 必须显式配置 `DASHSCOPE_MODEL`（如 `qwen-plus` 或本地用的 `deepseek-v4-pro-0813`）
8. ❌ 坑8：本机没有 docker 命令（未装 Docker Desktop），只有 Podman
   ✅ 解决：podman 兼容 docker 命令，构建/导出用 `podman build/save`；服务器端仍用 `docker load` 导入，两套 CLI 产物互认
9. ❌ 坑9：8123 端口未放行时，公网访问超时但服务器本机 curl 正常
   ✅ 解决：腾讯云控制台 + 宝塔防火墙都要放行 TCP 8123；上线后建议关裸端口走 Nginx 反代

## 五、后端部署流程（本地构建 → 服务器加载 → compose 启动）

### 0. 前置条件
- 本地：Podman（本机无 Docker，命令兼容），代码在 `D:\veyth-cog\VeythCog-C`
- 服务器：宝塔面板 + Docker + 现有 compose（含 pg-vector、pgadmin）

### 1. 本地构建镜像（多阶段，联网拉 Maven 依赖，约 5~15 分钟）
```powershell
cd D:\veyth-cog\VeythCog-C
podman build -t veyth-cog-backend:v1 -f Dockerfile .
# 构建上下文必须是项目根目录；Dockerfile 已排除 vc-learn，只构建生产模块
```

### 2. 本地导出镜像包
```powershell
podman save -o D:\veyth-cog\VeythCog-C\dist\veyth-cog-backend-v1.tar veyth-cog-backend:v1
# 产物约 300~500MB，dist/ 目录已被 .dockerignore 排除，不会污染下次构建上下文
```

### 3. 上传到服务器
宝塔 → 文件 → 进入服务器 compose 目录（pg-vector 那份 compose.yml 所在目录）→ 上传 tar 包

### 4. 服务器导入镜像
```bash
cd /path/to/compose目录
docker load -i veyth-cog-backend-v1.tar
docker images | grep veyth-cog   # 确认镜像已存在
```

### 5. 追加后端服务到 compose 并启动
- 把第二章 compose.yml 里的 `backend` 服务块复制追加到服务器现有 compose.yml（和 pg-vector 同一份）
- 按实际情况修改 `DASHSCOPE_API_KEY`、`DASHSCOPE_MODEL`、`JWT_SECRET`
```bash
docker compose up -d            # 只新增 backend，不影响已在跑的 pg-vector/pgadmin
docker compose ps               # 状态应为 running (healthy)
docker logs -f veyth-cog-backend  # 看启动日志，等待 "Started VcAppApplication"
```
> 关键点：backend 与 pg-vector 同网络，数据库连接地址写 `pg-vector:5432` 即可，无需改宿主机 IP

### 6. 验证 + 对外暴露
1. 服务器本机验证（绕过防火墙问题）：
   `curl http://127.0.0.1:8123/api/swagger-ui.html`（或登录接口 `POST /api/auth/login`）
2. 放行公网：腾讯云控制台 + 宝塔防火墙放行 TCP `8123`
3. 公网直连测试：`http://服务器公网IP:8123/api/swagger-ui.html`
4. 上线后建议走宝塔 Nginx 反代（可同时把 pgadmin 也反代掉）：
   - 宝塔 → 网站 → 添加站点/反向代理 → 目标 `http://127.0.0.1:8123`
   - location 规则保留 `/api` 前缀透传（如 `location /api { proxy_pass http://127.0.0.1:8123; }`，后端 context-path 自带 `/api`）
   - 配 SSL 证书 → EdgeOne 回源域名指向该域名

### 7. 版本迭代流程（改代码后再发版）
```powershell
cd D:\veyth-cog\VeythCog-C
podman build -t veyth-cog-backend:v2 -f Dockerfile .   # 版本号递增，保留旧镜像可回滚
podman save -o dist\veyth-cog-backend-v2.tar veyth-cog-backend:v2
```
```bash
# 服务器：导入后只重建 backend 容器（旧容器自动删，镜像保留）
docker load -i veyth-cog-backend-v2.tar
sed -i 's/veyth-cog-backend:v1/veyth-cog-backend:v2/' docker-compose.yml
docker compose up -d backend
```

## 六、连接汇总速查表
| 访问入口 | 地址 | 账号 | 密码 |
| ---- | ---- | ---- | ---- |
| pgadmin网页 | http://公网IP:5050 | admin@veyth.cog | Admin@123456 |
| PostgreSQL数据库（容器内） | pg-vector:5432 | postgres | 123456 |
| PostgreSQL数据库（宿主机） | 127.0.0.1:5432 | postgres | 123456 |
| VeythCog-C后端 | http://公网IP:8123/api | - | 接口文档 /api/swagger-ui.html |

---

> 本文档为部署唯一归档入口：镜像版本、compose 改动、踩坑记录持续在此维护更新。