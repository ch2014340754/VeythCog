# Design · P0 前后端串联（v2：MySQL + 绑定中间表 + 配置 AK）

## 〇、数据库（本机 MySQL 5.7）

- 连接：`jdbc:mysql://localhost:3306/vc`，`root/123456`（5.7.44）。
- 建库：`CREATE DATABASE vc DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
- 表结构（MySQL 版脚本在 `docs/sql/`，迁 PG 时按脚本头部注释调整）：

### `llm_vendor`（供应商枚举，种子 2 条）
| 列 | 类型 | 说明 |
|---|---|---|
| vendor_code | varchar(32) PK | deepseek / dashscope |
| vendor_name | varchar(64) | DeepSeek / 阿里百炼 |
| base_url | varchar(255) | 平台 base（deepseek 用官方 OpenAI 兼容地址） |
| enabled | tinyint(1) | 启用 |
| create_time | datetime | - |

### `llm_model`（模型目录，属于供应商）
| 列 | 类型 | 说明 |
|---|---|---|
| id | bigint PK auto | - |
| vendor_code | varchar(32) | FK → llm_vendor |
| model_code | varchar(64) | deepseek-chat / qwen-plus … |
| model_name | varchar(64) | 展示名 |
| max_context_tokens | int | 记忆截断用（预留） |
| temperature | decimal(3,2) | 默认温度 |
| enabled | tinyint(1) | - |
| create_time | datetime | - |
| unique(vendor_code, model_code) | | |

### `user_llm_binding`（用户-模型绑定中间表）
| 列 | 类型 | 说明 |
|---|---|---|
| id | bigint PK auto | - |
| user_id | bigint | FK → app_user |
| vendor_code | varchar(32) | - |
| model_code | varchar(64) | - |
| is_default | tinyint(1) default 0 | 是否默认模型（每用户至多 1 个，应用层保证） |
| enabled | tinyint(1) | - |
| create_time | datetime | - |
| unique(user_id, vendor_code, model_code) | | |

> 默认模型唯一性：MySQL 5.7 不支持 partial unique index，故由**应用层保证**（设置默认时先清该用户其他默认）。
> 迁 PG 时可在 `user_llm_binding` 上加 `unique(user_id) where is_default = 1` 的部分索引。

### `app_user`（用户，避开 user 保留字）
| 列 | 类型 | 说明 |
|---|---|---|
| id | bigint PK auto | - |
| username | varchar(64) unique | - |
| password | varchar(128) | BCrypt 密文 |
| nickname | varchar(64) | - |
| email | varchar(128) | - |
| create_time | datetime | - |

种子数据：deepseek + dashscope 两个供应商；dashscope→qwen-plus、deepseek→deepseek-chat 两个模型；admin 用户（BCrypt 密码）+ 绑定 qwen-plus。

## 一、后端设计（vc-chat）

### 1. 新增依赖（vc-chat/pom.xml）
- `spring-boot-starter-security`
- `io.jsonwebtoken:jjwt-api / jjwt-impl / jjwt-jackson`（0.12.x）
- `spring-boot-starter-data-jpa`
- `com.mysql:mysql-connector-j`（runtime）

### 2. 配置（application.yml / application-local.yml）
```yaml
# application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/vc?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: ${MYSQL_PASSWORD:123456}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate.ddl-auto: none   # 表由脚本管理，不用 Hibernate 自动建
    open-in-view: false
llm:
  vendors:
    dashscope:
      api-key: ${DASHSCOPE_API_KEY:}     # ← 用户稍后在此填写
      base-url: ""
    deepseek:
      api-key: ${DEEPSEEK_API_KEY:}      # ← 用户稍后在此填写
      base-url: https://api.deepseek.com/v1
jwt:
  secret: ${JWT_SECRET:dev-only-secret-change-me-0123456789}  # 本地开发默认值
  expire-hours: 24
```

### 3. 源码结构（新增/修改）
```
vc-chat/src/main/java/com/vc/vcchat/
├── config/SecurityConfig.java            # 无状态：放行 /auth/**，其余 authenticated
├── auth/
│   ├── jwt/JwtUtil.java                  # 签发/解析/校验（jjwt HS256）
│   ├── jwt/JwtAuthFilter.java            # OncePerRequestFilter
│   ├── entity/User.java                  # JPA 实体 → app_user
│   ├── repository/UserRepository.java    # findByUsername
│   └── service/impl/AuthServiceImpl.java # 查库 + BCrypt matches + 签 JWT
├── llm/
│   ├── entity/LlmVendor.java             # → llm_vendor
│   ├── entity/LlmModel.java              # → llm_model
│   ├── entity/UserLlmBinding.java        # → user_llm_binding
│   ├── repository/LlmVendorRepository.java
│   ├── repository/LlmModelRepository.java
│   ├── repository/UserLlmBindingRepository.java
│   ├── dto/LlmModelItem.java             # {vendor, modelCode, modelName, enabled, isDefault}
│   ├── dto/CatalogVendorItem.java        # {vendor, vendorName, baseUrl, models:[{modelCode,modelName,bound,enabled,isDefault}]}
│   ├── controller/LlmModelController.java # GET /llm/models · GET /llm/catalog · POST/DELETE /llm/bindings · PUT /llm/bindings/{vendor}/{modelCode}/default
│   ├── service/LlmModelService.java      # 绑定查询/增删/设默认/目录（含用户维度；设默认时先清该用户其他默认）
│   ├── factory/LlmVendorFactory.java     # 接口 create(config, apiKey, baseUrl) → ChatModel
│   ├── factory/DashScopeVendorFactory.java
│   ├── factory/OpenAiCompatVendorFactory.java
│   ├── router/LlmModelRouter.java        # 校验绑定 → 查模型配置 → 实例缓存 → 调用
│   └── LlmChatService.java               # 改造：chat(message, vendor, modelCode)
└── chat/ChatController.java              # 改造：POST /message {message,vendor,modelCode}
```

### 4. 接口签名（context-path=/api）
| 方法 | 路径 | 请求 | 成功 data | 鉴权 |
|---|---|---|---|---|
| POST | /api/auth/login | {username, password} | {token, username, nickname} | 否 |
| GET | /api/llm/models | - | [{vendor, modelCode, modelName, enabled, isDefault}] | 是 |
| GET | /api/llm/catalog | - | [{vendor, vendorName, baseUrl, models:[…bound…]}] | 是 |
| POST | /api/llm/bindings | {vendor, modelCode, isDefault?} | true | 是 |
| DELETE | /api/llm/bindings/{vendor}/{modelCode} | - | true | 是 |
| PUT | /api/llm/bindings/{vendor}/{modelCode}/default | - | true | 是（设为默认） |
| POST | /api/chat/message | {message, vendor, modelCode} | string | 是 |

### 5. 路由与工厂（核心）
- `LlmModelRouter.chat(userId, vendor, modelCode, message)`：
  1. `userLlmBindingRepository` 校验当前用户已绑定且模型 enabled；
  2. `llmModelRepository` 查模型配置；
  3. 缓存 `ConcurrentHashMap<"vendor:modelCode", ChatModel>` 懒创建：
     - dashscope → `DashScopeVendorFactory`（spring-ai-alibaba ChatModel，AK 取配置 `llm.vendors.dashscope.api-key`）
     - deepseek → `OpenAiCompatVendorFactory`（`OpenAiChatModel.builder()`, baseUrl=deepseek base-url, apiKey=配置值）
  4. `chatModel.call(new Prompt(message))` 返回文本。
- AK 未配置（空串）→ 抛 50000「该模型未配置密钥」。

## 二、前端设计（VeythCog-V）

### 1. 环境
- `.env.local`：`VITE_API_BASE=http://localhost:8123/api`、`VITE_USE_MOCK=false`（不提交）。
- `src/config/index.ts` 默认 apiBase 同步改为 `http://localhost:8123/api`（兜底）。

### 2. 改动清单
| 文件 | 改动 |
|---|---|
| `types/index.ts` | `Conversation` 增加 `vendor/modelCode/modelName`；新增 `LlmModelItem`（含 isDefault）、`CatalogVendorItem` |
| `api/index.ts` | 新增 `unwrap<T>(resp: BaseResponse<T>)`：code!==0 抛错，返回 data |
| `api/auth.ts` | `login` 改 `http.post('/auth/login')` 解包 data → User（name=nickname） |
| `api/llm.ts`（新） | `getModels()` / `getCatalog()` / `bindModel()` / `unbindModel()` / `setDefault()` |
| `api/chat.ts` | `sendMessage` 改 `http.post('/chat/message', {message, vendor, modelCode})` |
| `stores/settingsStore.ts` | `providers` 本地 CRUD → `models: LlmModelItem[]`（后端拉取）+ `currentModelId`（vendor:modelCode）；登录后自动选 isDefault 模型 |
| `stores/chatStore.ts` | 会话创建记录 vendor/modelCode/modelName |
| `pages/Chat/index.tsx` | 顶部模型下拉：无绑定→空态引导去配置；有绑定→自动选默认、新建会话可选、已有会话禁用；发送携带模型；渲染回复 |
| `pages/Settings/Providers.tsx` | 改为模型管理页：供应商枚举 + 模型目录 + 我的绑定（勾选增删 + 设为默认） |

### 3. 会话绑定交互
- 登录后加载 `GET /api/llm/models`：
  - 列表为空 → 对话页模型下拉显示空态，提示"尚未绑定模型，请到模型配置页选择厂商绑定"（提供跳转入口）。
  - 非空 → 自动选中 `isDefault=true` 的模型（无默认则选第一个），作为全局当前模型。
- 新建会话：模型下拉可编辑（默认取全局当前模型），创建后写入 Conversation.vendor/modelCode/modelName。
- 进入已有会话：下拉置灰不可编辑（「会话绑定模型」生产策略）。
- 前端本地会话数据（Zustand persist）不变，刷新保留。

## 三、联调与验证
1. 后端：`mvn -pl vc-chat -am compile` → 启动 8123 → curl 测 6 个接口（含鉴权、错误场景）。
2. 前端：`npm run build` → `npm run dev` 走 登录 → 绑定模型 → 新建会话选模型 → 发消息 → 收到回复 → 切会话下拉禁用。
3. 契约一致性：前端请求体/返回字段与后端 DTO 逐一核对。
