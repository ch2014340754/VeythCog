# VeythCog-C · 个人全栈工作台后端

> **渡思（VeythCog）** 个人全栈工作台的后端服务。
> 定位：以 Spring Boot 3 + Java 21 + Spring AI 落地 **LLM 应用工程** —— 多模型调度、RAG 检索、SSE 流式，作为个人作品集核心，同时沉淀自用能力。

## 项目全景（Monorepo）

```
D:\demo\
├── VeythCog-V   前端（React 18 + TS + Vite + AntD，个人 AI 工作台 UI）
└── VeythCog-C   后端（本仓库，Spring Boot 3 + Java 21 + Spring AI）
```

| 端                 | 技术栈                                  | 职责                                       |
| ------------------ | --------------------------------------- | ------------------------------------------ |
| VeythCog-V（前端） | React 18 / TS / Vite / AntD 5 / Zustand | 多模型对话、知识库、24+ 开发工具、设置     |
| VeythCog-C（后端） | Spring Boot 3.5 / Java 21 / Spring AI   | 认证、对话持久化、LLM 调度网关、RAG 知识库 |

## 技术栈

| 技术                           | 版本    | 用途                                |
| ------------------------------ | ------- | ----------------------------------- |
| Spring Boot                    | 3.5.8   | Web 基础框架                        |
| Java                           | 21      | 运行时                              |
| Spring AI Alibaba（DashScope） | 1.1.2.0 | 大模型接入（OpenAI 兼容）           |
| knife4j / OpenAPI 3            | 4.5.0   | 接口文档                            |
| Hutool                         | 5.8.46  | 工具库                              |
| Lombok                         | —      | 简化 POJO                           |
| PostgreSQL + pgvector          | 16      | 业务数据 + RAG 向量检索（规划接入） |

## 模块结构（模块化单体）

```
VeythCog-C/
├── pom.xml                # 父工程：仅依赖版本管理（dependencyManagement）+ 统一 properties
├── vc-common/             # 公共基础库：通用响应 / 异常体系 / 工具（纯 POJO，无 web / 无 AI）
│   └── com.vc.common
│       ├── common/        #   BaseResponse / ResultUtils / PageRequest
│       └── exception/     #   ErrorCode / BusinessException / ThrowUtils
├── vc-llm/                # LLM 调度网关域（库）：多厂商抽象 / 路由 / 模型管理
│   └── com.vc.llm         #   factory / router / entity / repository / service
├── vc-chat/               # 对话域（库）：会话 / 消息 / 记忆管理（依赖 vc-llm）
│   └── com.vc.chat        #   ChatService
├── vc-knowledge/          # 知识库域（库）：上传 / 解析 / 分块 / 检索
│   └── com.vc.knowledge   #   entity / service
├── vc-app/                # 唯一可运行应用（端口 8123，context-path /api）：组装各域
│   └── com.vc.app
│       ├── auth/          #   认证鉴权（JWT / User / 登录注册）
│       ├── web/           #   对外 Controller / DTO / 全局异常
│       ├── admin/         #   系统管理（应用层，横切各域）
│       ├── orchestration/ #   RAG 编排（跨域组合，chat 与 knowledge 在此装配）
│       └── config/        #   Security / Cors / 种子数据
├── vc-learn/              # Spring AI 学习沙箱（独立可运行，只连阿里百炼，零业务依赖）
└── docker-compose.yml     # PostgreSQL + pgvector（规划；当前本地用 MySQL）
```

**依赖方向**（单向、清晰）：`vc-common ← vc-llm ← (vc-chat, vc-knowledge) ← vc-app`。
除 vc-app 外均为纯库（无 boot 插件、无 main 类）；只有 vc-app 是可运行应用。

## 快速开始

### 1. 准备环境变量

```bash
# 复制 .env.example 为 .env，或直接设置系统环境变量
export DASHSCOPE_API_KEY=sk-xxx
```

### 2. 启动数据库（可选，Phase 0 接入 pgvector 后需要）

```bash
docker compose up -d postgres
```

### 3. 运行后端（vc-app 为唯一可运行应用）

```bash
# 方式一（推荐开发）：IDEA 直接运行 com.vc.app.VcAppApplication

# 方式二：命令行
mvn install -DskipTests            # 先把内部域模块装到本地仓库
cd vc-app && mvn spring-boot:run
```

启动后：

- 服务地址：`http://localhost:8123`
- 接口前缀：`/api`（如 `/api/health`）
- 接口文档：`http://localhost:8123/api/swagger-ui.html`

## 现有接口（骨架）

| 方法     | 路径                   | 说明                                                |
| -------- | ---------------------- | --------------------------------------------------- |
| GET      | `/api/health`        | 健康检查                                            |
| POST     | `/api/auth/login`    | 登录（当前 mock，admin 可登录）                     |
| POST     | `/api/auth/register` | 注册（当前 mock）                                   |
| POST     | `/api/chat/message`  | 对话（调用 DashScope，body:`{"message":"你好"}`） |
| GET/POST | `/api/knowledge`     | 知识库列表 / 创建（当前 mock）                      |

## 开发路线图（防烂尾：每阶段可演示）

| 阶段              | 内容                                                                     | 面试深水区     |
| ----------------- | ------------------------------------------------------------------------ | -------------- |
| **Phase 0** | 契约与骨架：JWT 登录、OpenAPI 契约、Docker(pgvector)、前端登录接真实接口 | —             |
| **Phase 1** | 多模型对话：供应商抽象 + 模型路由 + 降级重试 + SSE 流式 + 对话持久化     | ★ llm-gateway |
| **Phase 2** | RAG 知识库：上传→解析→分块→Embedding→pgvector 检索→带引用回答       | ★ RAG 管线    |
| **Phase 3** | 打磨部署：Docker 全栈、种子数据、架构文档、核心单测、演示脚本            | 叙事与指标     |

> 详细拆解见 [`docs/architecture.md`](docs/architecture.md)。

## 安全说明

- 大模型 API Key **从环境变量读取**（`${DASHSCOPE_API_KEY}`），`application-local.yml` 已被 gitignore。
- 若 Key 曾硬编码或泄露，请到 DashScope 控制台**轮换**。
- 生产环境禁止把任何密钥提交到仓库。

## 约定

- `vc-` 为后端模块/包前缀；`VeythCog-C` 对应后端，`VeythCog-V` 对应前端。
- 前后端通过 OpenAPI 契约并行开发，前端可先走 mock 再切真实接口。
