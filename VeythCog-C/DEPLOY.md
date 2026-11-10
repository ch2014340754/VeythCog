# VeythCog渡思｜腾讯轻量宝塔+Docker+pgvector 部署归档文档
> 环境：腾讯轻量云服务器，宝塔Ubuntu系统，Docker Compose编排
> 目标：PG15+pgvector向量库 + pgAdmin4网页管理工具 + VeythCog-C后端服务（SpringAI）
> 最后全链路验证：2026-11-06 —— 443 已监听、Let's Encrypt 证书已签发（至 2027-02-04）、`https://api.veythcog.top/api/health` 返回 200 `healthy`、`/api` 反代正常

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

3. **VeythCog-C 后端（SpringAI）**
- 镜像：`veyth-cog-backend:v1`（服务器 git 源码构建，见第五章）
- 容器名：`veyth-cog-backend`
- 容器内部访问地址：`127.0.0.1:8123`，context-path 为 `/api`
- 宿主机映射端口：`8123:8123`
- 对外地址：`https://api.veythcog.top/api`（宝塔 Nginx 443 反代 → `127.0.0.1:8123`，见第五章第4节）
- 接口文档（swagger/knife4j）：`https://api.veythcog.top/api/doc.html`、`.../api/swagger-ui.html`（内网可直连 `http://服务器公网IP:8123/api/doc.html`）
- 数据库连接：compose 同网络下写 `jdbc:postgresql://pg-vector:5432/veyth_cog`（compose 环境变量覆盖镜像默认值）
- 配置热改：`./backend-config` 挂载到 `/app/config`，改配置免重建镜像（见第六章）
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

  # ===== VeythCog-C 后端（镜像 tag 由 /opt/.env 的 BACKEND_TAG 决定，见第八章一键发版）=====
  backend:
    image: veyth-cog-backend:${BACKEND_TAG:-v1}
    container_name: veyth-cog-backend
    restart: unless-stopped
    environment:
      # 数据源覆盖为服务器本机的 pg-vector（同网络走容器名；镜像默认是 localhost，见踩坑6）
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
      # 外置配置目录（数据卷挂载到宿主机 ./backend-config，改配置免重建镜像，见第六章）
      SPRING_CONFIG_ADDITIONAL_LOCATION: file:/app/config/
    volumes:
      - ./backend-config:/app/config:ro
    ports:
      - "8123:8123"
    depends_on:
      - pg-vector
```
- 启动命令：`docker compose up -d`
- 停止命令：`docker compose down`
- 查看日志：`docker logs -f 容器名`

## 三、宝塔 & 腾讯云防火墙配置（必做）
1. 腾讯云轻量控制台防火墙：放行 TCP `80`、`443`、`5432`、`5050`、`8123`
2. 宝塔面板 → 安全 → 防火墙：放行 TCP `80`、`443`、`5432`、`5050`、`8123`
> `80` 是 Let's Encrypt「文件验证」所需；`443` 是 HTTPS 对外必需——两者都必须放行，否则 SSL 申请或访问会失败。
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

6. ❌ 坑6（已修复）：后端镜像 Dockerfile 曾内置默认数据源指向 Supabase（历史遗留的云库地址，含明文账号密码）
   ✅ 解决：现 Dockerfile 默认改为本机 PG（`localhost:5432/veyth_cog / postgres / 123456`），不再内置云库凭据；compose 里仍显式覆盖为 `pg-vector:5432/veyth_cog`（compose 环境变量优先级高于镜像 ENV）
7. ❌ 坑7：`DASHSCOPE_MODEL` 在 application.yml 中是 `${DASHSCOPE_MODEL}`（无默认值），不传会导致启动阶段占位符解析失败
   ✅ 解决：compose 必须显式配置 `DASHSCOPE_MODEL`（如 `qwen-plus` 或本地用的 `deepseek-v4-pro-0813`）
8. ❌ 坑8：本机没有 docker 命令（未装 Docker Desktop），只有 Podman
   ✅ 解决：podman 兼容 docker 命令，构建/导出用 `podman build/save`；服务器端仍用 `docker load` 导入，两套 CLI 产物互认
9. ❌ 坑9：8123 端口未放行时，公网访问超时但服务器本机 curl 正常
   ✅ 解决：腾讯云控制台 + 宝塔防火墙都要放行 TCP 8123；上线后建议关裸端口走 Nginx 反代

10. ❌ 坑10：宝塔 Let's Encrypt 报 `DNS problem: SERVFAIL looking up A for api.veythcog.top - the domain's nameservers may be malfunctioning; no valid AAAA records found` → 「验证失败」
    ✅ 排查结论：**不是 DNSSEC、也不是记录错**。用公共解析器（1.1.1.1 / 8.8.8.8 / 百度 180.76.76.76）+ Cloudflare 两个权威 NS（`ariadne/vasilii.ns.cloudflare.com`）直接查询，均能返回正确 A `111.230.146.233`，且 `DS=0`（未启用 DNSSEC）。该报错是**申请那一刻 DNS/缓存尚未稳定，或 LE 解析 Cloudflare NS 的瞬时故障**。
    ✅ 解决：确认 DNS 生效（80 端口通、站点根目录返回 200）后，**验证方法改用「文件验证」重新申请即一次成功**。注意报错里的 `no valid AAAA records found` 只是提示「没有 IPv6 记录」，**不是失败原因**，本域名本来就不需要 AAAA。

11. ❌ 坑11：本机一直解析到 Cloudflare 旧地址，误以为域名没生效 / 以为存在 AAAA
    ✅ 解决：本机/运营商 DNS 缓存残留（刚把 api 从「已代理」改成「仅 DNS」时的旧解析）。用 `Resolve-DnsName -Server 1.1.1.1 / 8.8.8.8` 交叉验证（应只返回 A=`111.230.146.233`、无 AAAA），再 `Clear-DnsClientCache`（Windows）清本机缓存后复测。**判断「有没有 AAAA」必须看 Cloudflare 面板记录（api 只有一条 A、仅 DNS），不能只凭本机 nslookup。**

12. ❌ 坑12：在宝塔「网站列表」页找不到 Let's Encrypt 入口
    ✅ 正确位置：**网站列表 → 站点行右侧「设置」→ 左侧菜单「SSL」页签**。品牌选 Let's Encrypt、算法 RSA2048、**验证方法选「文件验证」**最省事；若选「DNS验证」，必须勾「手动解析」（去 Cloudflare 加 TXT，仅 DNS/灰云）或点「配置DNS」填 Cloudflare API Token，否则必然失败。

13. ❌ 坑13：EdgeOne「云项目」控制台没有路径规则 / 回源规则入口，无法在同一域名下用 `/api` 分流
    ✅ 结论：放弃「`www` 同域 /api 分流」，改用后端独立子域名 `api.veythcog.top`（DNS 指向服务器 + 宝塔 Nginx 反代）。前端继续留在 EdgeOne 不动。

14. ❌ 坑14：服务器上 `chmod +x deploy.sh` 后，`git pull` 报「有本地改动未提交」，发版脚本也中止；服务器又没配 git 用户信息，没法 commit
    ✅ 原因：`chmod` 把文件权限位 644→755，git（默认 `core.fileMode=true`）把权限位变化视为本地修改。
    ✅ 解决（服务器执行一次）：
    ```bash
    cd /opt/veyth-cog && git config core.fileMode false && git status --short   # 变干净后即可 git pull
    ```
    脚本的脏工作区检查已改为 `git -c core.fileMode=false diff --quiet`，以后 chmod 不再误判。
    ✅ 长期根治（本地仓库，让仓库记录 100755）：`git update-index --chmod=+x VeythCog-C/deploy.sh` 后 commit+push，服务器 pull 下来自带可执行位，无需再 chmod。

15. ❌ 坑15：镜像构建在 `[build N/N] mvn install` 阶段失败，报
    `Non-resolvable parent POM for com.vc:veythcog-c ... spring-boot-starter-parent:pom:3.5.8 (absent): Could not transfer ... from/to aliyun-central (https://maven.aliyun.com/repository/central): maven.aliyun.com: Temporary failure in name resolution`
    ✅ 这是**两层问题**，要分开修：

    **(a) 仓库声明多余**：根 pom 曾声明 `spring-milestones`，而 `maven-settings.xml` 只镜像 central，`repo.spring.io` 走直连。3.5.8 是 GA 版本，milestone 仓库里本来就没有（该 URL 返回 404），这个声明纯属多余。已删除该仓库，`mirrorOf` 改为 `external:*`，所有远程仓库统一走阿里云。

    **(b) 真正的拦路虎：构建容器 DNS 不可用**。改完仓库后报错变成 `maven.aliyun.com: Temporary failure in name resolution` —— 说明问题不在仓库配置，而是 **BuildKit 的 RUN 容器解析不了任何域名**。宿主机能 `docker pull` 不代表构建容器能解析：`docker pull` 由 daemon 自己解析，而 Dockerfile 的 RUN 容器是复制宿主的 `/etc/resolv.conf` 进去的，宿主若跑 systemd-resolved / 本机 dnsmasq，里面就是 `nameserver 127.0.0.53` / `127.0.0.1`，在容器网络里根本不可达，于是全部域名解析失败。
    ✅ 解决（按代价从小到大，任选其一即可）：
    ```bash
    # 1) 先确认根因（nameserver 是 127.x 就是它）
    cat /etc/resolv.conf
    docker run --rm --network=host maven:3.9-eclipse-temurin-21 sh -c 'getent hosts maven.aliyun.com'

    # 2) 首选：构建时共享宿主网络（deploy.sh 已默认加 --network=host，无需改配置、不动线上容器）
    docker build --network=host -t veyth-cog-backend:test .

    # 3) 根治：给 Docker 显式指定 DNS（会重启 docker，现有容器需重新 up）
    cat /etc/docker/daemon.json          # 已有内容的话合并进去，别覆盖 registry-mirrors
    #   { "dns": ["223.5.5.5", "119.29.29.29"] }
    systemctl restart docker
    cd /opt && docker compose up -d      # 把被重启中断的容器拉起来
    ```
    关闭 host 网络构建：`BUILD_NETWORK= bash deploy.sh`（显式传空值）。

16. ❌ 坑16：Dockerfile 构建链里已有 `mvn -f vc-nav/pom.xml`，但 COPY 列表漏了 vc-nav 的 pom 与源码（`/workspace/vc-nav/pom.xml` 不存在）
    ✅ 解决：补齐 `COPY vc-nav/pom.xml vc-nav/` 与 `COPY vc-nav vc-nav`。**新增模块纳入生产构建时，COPY pom / COPY 源码 / mvn -f 三处必须同步**，否则网络修好后仍会在这里挂。

17. ❌ 坑17：镜像构建成功，但容器起不来，报
    `failed to set up container networking: driver failed programming external connectivity on endpoint veyth-cog-backend ... Unable to enable DNAT rule: (iptables failed: iptables --wait -t nat -A DOCKER -p tcp -d 0/0 --dport 8123 -j DNAT --to-destination 172.20.0.4:8123: iptables: No chain/target/match by that name)`
    ✅ 含义：镜像本身没问题，是 Docker 在给容器写端口转发时找不到 iptables 的 `DOCKER` 链。`docker compose` 重建容器时会先删旧容器，所以**这一刻 backend 是停着的，公网 502，要先恢复**。
    ✅ 三类成因，按概率排：
    1. **DOCKER 链被清空**：重启 docker、`firewall-cmd --reload`、手动 `iptables -F` 之后都可能出现；docker 只有自己启动时才重建这条链。
    2. **NAT 内核模块没加载**：`nf_nat` / `iptable_nat` 缺失（内核升级、模块被卸）。
    3. **iptables 后端混用**：系统同时装 `iptables-legacy` 与 `iptables-nft`，docker 用一套建链、另一套查不到。
    ✅ 修复（第一条命令集通常一次解决）：
    ```bash
    modprobe nf_nat; modprobe iptable_nat
    systemctl restart firewalld 2>/dev/null || true    # 让 firewalld 先重载完，避免它再清一次
    systemctl restart docker                           # docker 启动时重建 DOCKER 链（容器 restart:unless-stopped 会自动回来）
    iptables -t nat -S DOCKER | head -5                # 能看到 -A DOCKER ... 即恢复
    cd /opt && docker compose up -d                    # 兜底：把容器全部拉起来
    curl -s http://127.0.0.1:8123/api/health
    ```
    若 `iptables -t nat -S DOCKER` 仍为空，继续查：
    ```bash
    iptables -V; iptables-legacy -V 2>/dev/null; iptables-nft -V 2>/dev/null   # 看是否两套后端混用
    grep -i iptables /etc/docker/daemon.json    # 出现 "iptables": false 必须改成 true 或删掉该键
    ```
    ⚠️ 此后重启 docker 必须同时确认：docker 重建的链不要再被 firewalld 的 reload 清掉；顺序上「先重启 firewalld，再重启 docker」最稳。

18. ❌ 坑18：壁纸/附件在**部分设备**上加载不出来，Network 里那条请求的地址是 `https://rustfs:9000/wallpapers/xxx.jpg?...`
    ✅ 原因：后端用 `storage.s3.endpoint`（容器内服务名 `http://rustfs:9000`）生成预签名 URL，这个主机名只有 Docker 网络内部认识，公网浏览器必然解析失败。而且 **SigV4 签名把 Host 算进了 canonical request**，所以不能「签内网地址、让浏览器换成公网域名访问」——换 Host 就是 403，必须直接用公网地址签。
    ✅ 有的设备"看起来正常"，通常是浏览器缓存住了历史图片，或前端兜底成了本地默认壁纸，并不是真的从 S3 取到了。
    ✅ 解决：新增配置 `storage.s3.public-endpoint`（环境变量 `RUSTFS_PUBLIC_ENDPOINT`），**只用于生成 URL，不用于后端发起请求**；客户端仍走内网 `RUSTFS_ENDPOINT`。
    ```dotenv
    # /opt/.env（compose 已内置默认 https://api.veythcog.top，可在此覆盖）
    RUSTFS_PUBLIC_ENDPOINT=https://api.veythcog.top
    ```
    ⚠️ 服务器实际生效的是 `/opt/compose.yml`（和仓库里的 `docker-compose.yml` 是两份），所以要在 **`/opt/compose.yml` 的 `backend.environment`** 里补一行（缩进与其它键一致）：
    ```yaml
        RUSTFS_PUBLIC_ENDPOINT: https://api.veythcog.top
    ```
    不改这一行，即使 `.env` 里写了变量也不会传进容器（compose 文件没引用它）。改完 `docker compose up -d --no-deps backend` 生效。
    ✅ Nginx（宝塔站点 `api.veythcog.top` → 站点设置 → 配置文件）追加：**路径原样转发**，桶名做一级路径，这样签名里的 URI 与 Host 都不变：
    ```nginx
    # S3 对象直读：桶名即一级路径，必须原样转发（不能 rewrite/去前缀，否则签名校验失败）
    location /wallpapers/ {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;              # 必须保持外网 Host，SigV4 要校验它
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100m;                # 走预签名 PUT 上传大文件时放宽
        proxy_request_buffering off;
        proxy_buffering off;
    }
    # 公开图标桶同理（匿名可读的 public-icons）
    location /public-icons/ {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
    }
    ```
    验证：
    ```bash
    curl -sI "https://api.veythcog.top/wallpapers/随便一个已存在的key.jpg"   # 期望 200 或 403(签名问题)，不能是 404/502
    docker logs --tail=50 veyth-cog-backend | grep 预签名                     # 应出现「预签名地址使用公网 endpoint」
    ```
    补充：壁纸预签名有效期已从默认 15 分钟提到 7 天（见 `NavWallpaperService`），避免页面挂久了刷新即 403。

## 五、后端部署流程（首选：服务器 git 拉源码 → 服务器构建 → compose 启动）

> 源码已通过 git 克隆到服务器 `/opt/veyth_cog/veyth-cog/`，后端根目录为 `/opt/veyth_cog/veyth-cog/VeythCog-C`（含 pom.xml / Dockerfile / vc-* 模块）。直接在服务器构建，省去本地打包+传大文件。
> 远端仓库：`origin https://gitee.com/TSWQ/veyth-cog.git`（master）

### 0. 前置条件
- 服务器已有 Docker + 现有 compose（pg-vector、pgadmin）
- 源码已在服务器 `/opt/veyth_cog/veyth-cog/VeythCog-C`

### 1. 拉取/更新源码（发版前先同步最新代码）
```bash
cd /opt/veyth_cog/veyth-cog/VeythCog-C && git pull
# 注意：本地改动务必先 commit + push 到 gitee，否则服务器拉到的是旧代码
```

### 2. 服务器构建镜像
```bash
cd /opt/veyth_cog/veyth-cog/VeythCog-C
docker build --network=host -t veyth-cog-backend:v1 .
# --network=host：构建容器共享宿主网络栈，绕开「容器内 DNS 解析失败」（详见坑15）
# 构建上下文=后端根目录；多阶段构建，需联网拉 maven:3.9-eclipse-temurin-21 / eclipse-temurin:21-jre + Maven 依赖
# 首次约 5~15 分钟；Dockerfile 已配阿里云 Maven 镜像 + BuildKit 依赖缓存（--mount=type=cache,target=/root/.m2），
# 之后改源码重建不再重复下载依赖（需 Docker 23+ / BuildKit，旧版加 DOCKER_BUILDKIT=1）
docker images | grep veyth-cog   # 确认镜像已构建
```
> ⚠️ 若 Docker Hub 拉取超时/被重置（国内常见）：配置腾讯云内网镜像再重试
> ```bash
> # /etc/docker/daemon.json 写入
> echo '{"registry-mirrors":["https://mirror.ccs.tencentyun.com"]}' > /etc/docker/daemon.json
> systemctl restart docker
> ```

### 3. 追加后端服务到 compose 并启动
```bash
# 先找到 pg-vector 那份 compose 所在目录（容器上的 compose 工作目录标签）
docker inspect pg-vector --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
# 把第二章 compose.yml 里的 backend 服务块追加到该 compose（和 pg-vector 同一份），
# 改好 DASHSCOPE_API_KEY / DASHSCOPE_MODEL / JWT_SECRET 后执行：
docker compose up -d
docker compose ps                # backend 应为 running (healthy)
docker logs -f veyth-cog-backend  # 等待 "Started VcAppApplication"
```
> 关键点：backend 与 pg-vector 同网络，数据库连接地址写 `pg-vector:5432` 即可，无需改宿主机 IP

### 4. 对外暴露（子域名 `api.veythcog.top`，已实测跑通 2026-11-06）

> 前端 `https://www.veythcog.top`（EdgeOne 云项目，git 自动构建）负责页面；后端通过子域名 `https://api.veythcog.top` 对外；后端已配 CORS 放行 `www.veythcog.top`。
> 实测结果：443 已监听、证书 Let's Encrypt 签发、`https://api.veythcog.top/api/health` 返回 200 `healthy`、`/api/doc.html` 返回 200。

**⚠️ 顺序很关键：先 DNS → 再 SSL → 再反代 → 最后前端指向。DNS 没确认生效前不要申请证书。**

#### 4.1 DNS（Cloudflare）——最容易翻车，务必先做
1. Cloudflare → DNS → 给 `api.veythcog.top` 添加 **A 记录 → 服务器公网 IP `111.230.146.233`**；
2. 代理状态必须选 **「仅 DNS」（灰云）**，**不要开橙云**。开橙云会让流量绕 Cloudflare（未配好时 HTTPS 回 `521`），并可能干扰 Let's Encrypt 验证；
3. **确认 api 没有 AAAA 记录**（本域名不需要 IPv6）。浏览器优先走 IPv6，一旦 AAAA 残留指向 Cloudflare，请求会被拽回 CF，浏览器表现为「响应标头 0」或 `521`；
4. **用公共解析器交叉验证 DNS 是否真的生效**（不要只看本机缓存）：
   ```powershell
   Resolve-DnsName api.veythcog.top -Server 1.1.1.1 | ? {$_.Type -in 'A','AAAA'}
   Resolve-DnsName api.veythcog.top -Server 8.8.8.8 | ? {$_.Type -in 'A','AAAA'}
   ```
   期望**只返回 A = `111.230.146.233`、无 AAAA**。若本机/运营商仍返回旧 Cloudflare 地址，执行 `Clear-DnsClientCache` 后复测（属缓存残留，不是记录配错）。
   > 实测环境：Cloudflare 权威 NS = `ariadne.ns.cloudflare.com` / `vasilii.ns.cloudflare.com`；**未启用 DNSSEC（DS=0）**；两权威 NS 直接查询均返回正确 A。

#### 4.2 宝塔建站 + SSL（一次成功流程）
1. 宝塔 → 网站 → **添加站点** `api.veythcog.top`（PHP 选「静态」即可，根目录用默认）；
2. 站点行右侧点 **「设置」** → 左侧菜单进 **「SSL」**（**Let's Encrypt 入口在站点「设置」里，不在网站列表页**）；
3. 申请免费证书（弹窗「申请免费证书」）：
   - 品牌：**Let's Encrypt**；算法：**RSA2048**；
   - 验证方法：**「文件验证」**（DNS 已生效 + 80 端口通 + 站点根目录 200 时，文件验证一次过，**不需要 API Token、无需手动加 TXT**）；
   - 勾选域名 `api.veythcog.top` → **申请证书**；
4. 成功后打开 **「强制 HTTPS」**；宝塔会自动监听 443（`Test-NetConnection 443` 应变为 True）。
   > ✅ 实测签发：Issuer `Let's Encrypt (YR1)`，CN `api.veythcog.top`，有效期至 **2027-02-04**（3 个月自动续期，宝塔会定时续签）。

#### 4.3 Nginx 反向代理 `/api` → 后端
- 宝塔 → 站点设置 → **「反向代理」** → 添加：
  - 目标 URL：`http://127.0.0.1:8123`
  - 发送域名：`$host`
- 或手动改站点配置（等价写法）：
  ```
  location /api {
      proxy_pass http://127.0.0.1:8123;      # 不带尾部 /
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```
  > `proxy_pass` 不带尾部 `/` 才会原样透传 `/api/...`，正好匹配后端 context-path `/api`。
- **未配反代时的典型现象**：`http(s)://api.veythcog.top/api/health` 返回 **404**（请求落到空的静态目录）。

#### 4.4 验证（三条都要过）
```bash
curl -I https://api.veythcog.top/api/health      # 期望 200
curl https://api.veythcog.top/api/health          # 期望 healthy
curl -I https://api.veythcog.top/api/doc.html     # 期望 200
```
浏览器打开 `https://www.veythcog.top` 登录 / 对话正常。

#### 4.5 前端指向
`.env.production` 设 `VITE_API_BASE=https://api.veythcog.top/api`，commit+push 后 EdgeOne 自动重新构建。
> `VITE_*` 是 **Vite 构建时**注入，改后必须重新构建/重部署才生效。

#### 4.6 CORS 与端口收敛
- 后端 `SecurityConfig` 已加 `corsConfigurationSource` bean：放行 `https://www.veythcog.top`、`http://localhost:5173`、`http://localhost:3000`；headers 含 `Authorization`，methods 含 `OPTIONS`，`maxAge=3600`；认证走 Authorization 头，**不开 credentials**；
- 后端 `8123` 无需对公网开放，只经宝塔 Nginx（443）对外；上线后建议关掉裸端口 8123。

#### 4.7 排障速查（按「解析 → 传输 → 端口 → 配置」四层定位）
| 现象 | 含义 / 下一步 |
| --- | --- |
| 浏览器「响应标头 (0)」 | 服务器没回包；**别查后端日志/CORS**，先看 DNS 与端口 |
| `521` | 流量仍经 Cloudflare 代理且回源失败 → 把 api 改「仅 DNS」 |
| 「目标计算机积极拒绝」 | 已直达服务器，但 **443 端口未监听**（SSL 未装） |
| `Test-NetConnection 443 = False` | SSL 没装 / 未监听；去宝塔 SSL 页签申请 |
| 80 返回 `404` | 站点已建但**反向代理未配**（请求落到空静态目录） |

### 5. 版本迭代流程（改代码后再发版）
```bash
# 本地：改完代码 commit+push 到 gitee
# 服务器：
cd /opt/veyth_cog/veyth-cog/VeythCog-C && git pull
docker build -t veyth-cog-backend:v2 .     # 版本号递增，保留旧镜像可回滚
sed -i 's/veyth-cog-backend:v1/veyth-cog-backend:v2/' <compose路径>/docker-compose.yml   # 同步 compose 的 image 引用
docker compose up -d --no-deps backend     # 只重建 backend，不动 pg-vector/pgadmin
```
> ⚠️ 升级**不要** `docker compose down` 全停（会连带移除 pg-vector/pgadmin 容器，没必要）；
> 只重建 backend 即可。若用覆盖式 tag（如一直 `:v1`）重新 build，需加 `--force-recreate` 强制重建：
> `docker compose up -d --no-deps --force-recreate backend`
> 数据库数据在 named volume `pgdata`，up/down 不丢；**切勿 `docker compose down -v`**（-v 会删数据卷）。

### 备选方案：本地打包镜像上传（服务器无法联网构建 Docker Hub 时）
本地 `podman build -t veyth-cog-backend:v1 .`（本机无 docker，用 podman）→ `podman save -o veyth-cog-backend-v1.tar` → 宝塔上传 → 服务器 `docker load -i` → compose 引用镜像名启动

## 六、配置文件数据卷挂载：改配置免重建镜像

> 原理：compose 已把宿主机目录 `./backend-config` 只读挂载到容器 `/app/config`，并注入
> `SPRING_CONFIG_ADDITIONAL_LOCATION=file:/app/config/`。Spring Boot 会**优先加载**这个外置目录里的
> 配置文件，覆盖 jar 内打包的同名配置。改配置只需编辑宿主机文件 → `docker compose restart backend`，
> **不用重新 build 镜像**。

### 1. 在 compose 目录下创建配置目录和文件
```bash
mkdir -p ./backend-config
# 生产环境生效的文件名必须带 prod 后缀（因为镜像里 SPRING_PROFILES_ACTIVE=prod）
vi ./backend-config/application-prod.yml
```
示例内容（按需增删，只写想覆盖的键；数据源/AI Key 已在 compose environment 里，无需重复）：
```yaml
server:
  port: 8123
jwt:
  secret: "改成你自己的长随机串"
  expire-hours: 24
spring:
  ai:
    dashscope:
      chat:
        options:
          model: qwen-plus
```

### 2. 生效方式（三选一）
- 首次部署：`docker compose up -d` 会自动挂载
- 已运行后改了配置：`docker compose restart backend`（秒级，不重建）
- 改了 compose 本身（增删挂载/环境变量）：`docker compose up -d --force-recreate backend`

### 3. 验证配置已生效
```bash
docker exec veyth-cog-backend sh -c 'ls /app/config/'
docker logs veyth-cog-backend | grep -i 'external|config'   # 可看到 external config 加载路径
```

### 4. 常见可热改项（都放 application-prod.yml）
`jwt.secret / jwt.expire-hours`、`spring.ai.*（模型、temperature 等）`、`knife4j`、`server.*`、`logging.*`。
> 若要改数据源/API Key/内存，直接在 compose environment 里改后 `docker compose up -d --force-recreate backend` 即可，同样不重建镜像。

## 七、连接汇总速查表
| 访问入口 | 地址 | 账号 | 密码 |
| ---- | ---- | ---- | ---- |
| pgadmin网页 | http://公网IP:5050 | admin@veyth.cog | Admin@123456 |
| PostgreSQL数据库（容器内） | pg-vector:5432 | postgres | 123456 |
| PostgreSQL数据库（宿主机） | 127.0.0.1:5432 | postgres | 123456 |
| VeythCog-C后端（内网/直连） | http://公网IP:8123/api | - | 接口文档 /api/doc.html |
| **VeythCog-C 对外 API（HTTPS）** | **https://api.veythcog.top/api** | - | 宝塔 Nginx 反代 → 127.0.0.1:8123；文档 /api/doc.html |
| SSL 证书 | `api.veythcog.top` | Let's Encrypt（YR1） | 2026-11-06 签发，至 2027-02-04，宝塔自动续签 |

---

## 八、日常发版（时间戳 tag + 一键脚本，不手改 compose.yml）

### 8.1 一次性准备：把 compose 的 tag 变量化
把 `/opt/docker-compose.yml` 里 backend 的镜像改成变量引用：
```yaml
  backend:
    image: veyth-cog-backend:${BACKEND_TAG:-v1}
```
在 compose 同目录建 `.env`（**docker compose 会自动读取同目录的 `.env`**）：
```bash
echo "BACKEND_TAG=v1" >> /opt/.env
```
> 之后每次换 tag **只改 `/opt/.env`**（由脚本自动改），`docker-compose.yml` 永不再动。

### 8.2 一键脚本用法
安装（`git pull` 后脚本已在 `VeythCog-C/deploy.sh`）：
```bash
cd /opt/veyth-cog && git config core.fileMode false   # 关键：忽略 chmod 造成的权限位差异，避免被当成"本地改动"
chmod +x /opt/veyth-cog/VeythCog-C/deploy.sh
echo "alias deploy='bash /opt/veyth-cog/VeythCog-C/deploy.sh'" >> ~/.bashrc && source ~/.bashrc
```
```bash
deploy                           # 发版，tag 自动 = vYYYYMMDD-HHMM（时间戳）
deploy v2                        # 发版，指定 tag
deploy list                      # 列出所有 tag（挑回滚点）
deploy current                   # 查看当前生效 tag / 运行镜像
deploy rollback v20261106-1430   # 回滚到指定 tag
```
流程（任一步失败立即中止）：
1. 环境检查：docker / compose 插件 / 仓库 / Dockerfile / docker-compose.yml；
2. `git pull --ff-only`：**有未提交改动会先中止**（不会覆盖手改文件），打印前后 commit；
3. `DOCKER_BUILDKIT=1 docker build --network=host -t veyth-cog-backend:<tag> .`（沿用 BuildKit 依赖缓存；host 网络用于绕开容器 DNS，见坑15，可用 `BUILD_NETWORK= deploy` 关闭）；
4. 写 `/opt/.env` 的 `BACKEND_TAG=<tag>` → `docker compose config` 校验变量生效 → `docker compose up -d --no-deps backend`；
5. 轮询 `http://127.0.0.1:8123/api/health` 直到 200，失败自动打印 `docker logs --tail=80 backend`。

> **为何不用手改 yml**：compose 的 `${BACKEND_TAG:-v1}` 在每次 `docker compose up` 时都会按 `.env` 重新求值。
> **防呆校验**：脚本会跑 `docker compose config` 确认解析出的是目标 tag；若 compose 里 tag 写死，脚本会直接报错并提示改法（避免「换了 tag 仍在跑旧镜像」）。

### 8.3 回滚
```bash
deploy list                       # 找到要回的旧 tag
deploy rollback v20261106-1430    # 自动改 .env + 重建 + 健康检查
```

### 8.4 镜像保留策略（自动清理，避免占满硬盘）
- 每次 `deploy` 成功后的 `5/5` 步骤自动清理：**保留最近 3 个 tag（当前版 + 之前两版）**，并强制保留正在运行的 tag；
- 同时清理悬空镜像（`<none>` tag，重复 build 的残留层）；
- 调整保留数量：临时用 `KEEP_IMAGES=5 deploy`，永久改脚本顶部 `KEEP_IMAGES="${KEEP_IMAGES:-3}"`；
- 手动清理：`deploy clean`；
- 被容器引用的镜像会**跳过**（输出「仍被容器引用」），不会删掉在用的镜像；
- 结论：可回滚的旧版最多保留 2 个；若要回更早的版本，需重新 build 对应代码。

### 8.5 手动命令（无脚本时等价操作）
```bash
cd /opt/veyth-cog && git pull
cd /opt/veyth-cog/VeythCog-C && docker build --network=host -t "veyth-cog-backend:v$(date +%Y%m%d-%H%M)" .
sed -i "s/^BACKEND_TAG=.*/BACKEND_TAG=<刚构建的tag>/" /opt/.env
cd /opt && docker compose up -d --no-deps backend
```
> 早期克隆位置为 `/opt/veyth_cog/veyth-cog/`（下划线+连字符）；现已简化为 `/opt/veyth-cog`。脚本按自身位置向上定位仓库根，正常无需改；异常时用 `REPO_DIR=... BACKEND_DIR=... bash deploy.sh` 显式指定。

> 本文档为部署唯一归档入口：镜像版本、compose 改动、踩坑记录持续在此维护更新。
> 最近更新：2026-11-06 —— SSL 全链路打通；发版改为「时间戳 tag + `.env` 驱动」，`deploy.sh` 支持 release/list/current/rollback。