# Spring AI 1.1.x API 参考与示例

> 适用版本：Spring AI **1.1.2**（本项目 VeythCog-C 所用），参考文档以官方 **1.1.8** 为准（1.1.x 线内 API 稳定，无逐 patch 文档）。
> 官方文档固定版本入口：`https://docs.spring.io/spring-ai/reference/1.1.8/`（或 `/reference/1.1/`）。
> 本文件面向"跟着过时教学视频学习、用 1.1.x 新写法重写"的场景，重点标注**过时 API → 1.1.x 写法**对照。

---

## 0. 版本与文档怎么选

- Spring AI 2.0.x 需要 **Spring Boot 4.0/4.1 + Spring Framework 7**，本项目在 Boot 3.5.8 + Spring AI 1.1.2，**不要用 2.0 文档**。
- 1.1.x 稳定版文档对应 **1.1.8** 链接（右上角版本下拉选 `Stable → 1.1.8`）。
- 1.0.x 是上一代，部分 API 位置/写法与 1.1 不同，别混用。
- 打开 1.1.8 页面顶部有"latest stable is 2.0.1"横幅，是引导新项目的，与本项目无关，忽略即可。

---

## 1. 依赖与自动装配

### 1.1 引入依赖（本项目已在用）

```xml
<!-- 阿里百炼 DashScope starter：提供 dashScopeChatModel + ChatClient.Builder 自动装配 -->
<dependency>
    <groupId>com.alibaba.cloud.ai</groupId>
    <artifactId>spring-ai-alibaba-starter-dashscope</artifactId>
</dependency>
<!-- OpenAI 兼容协议（DeepSeek 等） -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-openai</artifactId>
</dependency>
```

版本由父 pom 的 BOM 统一管理（`spring-ai.version=1.1.2`、`spring-ai-alibaba.version=1.1.2.0`）。

### 1.2 官方 JDBC 记忆仓库（可选，官方组件）

官方 1.1.x 提供开箱即用的 JDBC 记忆仓库，可自动建表：

```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-model-chat-memory-repository-jdbc</artifactId>
</dependency>
```

> 说明：本项目 VeythCog-C 为不依赖该 starter、自控建表，手写了 `JdbcChatMessageRepository`（实现 `ChatMemoryRepository`）。两种做法等价：官方组件"少写代码"，手写"表结构自己掌控"。

---

## 2. ChatModel vs ChatClient（核心）

- **ChatModel**：底层模型抽象，`chatModel.call(prompt)` 直接调用。
- **ChatClient**：推荐的链式门面，封装 Prompt、Advisors、Structured Output、Tools，内部还是走 ChatModel。

### 2.1 创建 ChatClient

```java
// 方式一：Spring Boot 自动装配的 Builder（最常用，注入即可）
private final ChatClient chatClient;
public MyController(ChatClient.Builder builder) {
    this.chatClient = builder.build();
}

// 方式二：手动基于某个 ChatModel 创建
ChatClient chatClient = ChatClient.builder(chatModel).build();
// 或更简：
ChatClient chatClient = ChatClient.create(chatModel);
```

### 2.2 基本调用（同步）

```java
String answer = chatClient.prompt()
    .user("今天天气怎么样？")
    .call()
    .content();
```

### 2.3 流式调用（异步，返回 Flux<String>）

```java
Flux<String> flux = chatClient.prompt()
    .user("讲个笑话")
    .stream()
    .content();
```

### 2.4 携带系统消息 / 参数

```java
String answer = chatClient.prompt()
    .system("你是一个资深的 Java 后端工程师")
    .user(u -> u.text("请解释 {concept}")
        .param("concept", "Spring AI Advisor"))
    .call()
    .content();
```

### 2.5 返回结构化对象（Structured Output）

```java
record ActorFilms(String actor, List<String> movies) {}

ActorFilms films = chatClient.prompt()
    .user("给汤姆·汉克斯列出 5 部电影")
    .call()
    .entity(ActorFilms.class);

// 泛型集合用 ParameterizedTypeReference
List<ActorFilms> list = chatClient.prompt()
    .user("...")
    .call()
    .entity(new ParameterizedTypeReference<List<ActorFilms>>() {});
```

### 2.6 call() 的返回值形态

| 方法 | 返回 | 用途 |
|---|---|---|
| `content()` | `String` | 只要回复文本 |
| `chatResponse()` | `ChatResponse` | 带元数据（token 用量、generation） |
| `chatClientResponse()` | `ChatClientResponse` | 含 Advisor 执行上下文（RAG 命中文档等） |
| `entity(Class)` | `T` | 结构化输出 |
| `entity(ParameterizedTypeReference)` | `T` | 泛型结构化输出 |
| `responseEntity(...)` | `ResponseEntity` | 同时要 ChatResponse + 对象 |

---

## 3. Messages（消息类型）

```java
import org.springframework.ai.chat.messages.*;

UserMessage u = new UserMessage("你好");           // 用户消息
AssistantMessage a = new AssistantMessage("你好");  // 助手消息
SystemMessage s = new SystemMessage("你是助手");     // 系统消息
MessageType type = u.getMessageType();              // USER / ASSISTANT / SYSTEM / TOOL
String text = u.getText();                          // 取文本
```

> 注意：取文本用的是 `getText()`（`Message` 继承自 `Content`），**没有** `getContent()`。

---

## 4. Prompt 与模板

```java
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.chat.messages.Message;

PromptTemplate pt = new PromptTemplate("请用一句话解释 {topic}");
Prompt prompt = pt.create(Map.of("topic", "依赖注入"));

// 或用 ChatClient 内联模板（推荐）
String answer = chatClient.prompt()
    .user(u -> u.text("用一句话解释 {topic}").param("topic", "AOP"))
    .call()
    .content();
```

---

## 5. Tool / Function Calling（工具调用）

> 1.0 时代叫 **Function Calling / FunctionCallback**，1.1 重构为 **Tool Calling / ToolCallback**。
> 迁移对照：`FunctionCallback` → `ToolCallback`；`@Tool` 声明式最常用。

### 5.1 声明式 @Tool（推荐）

```java
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

class DateTimeTools {
    @Tool(description = "获取当前日期时间")
    String getCurrentDateTime() {
        return LocalDateTime.now().toString();
    }

    @Tool(description = "计算两数之和")
    int add(@ToolParam(description = "第一个数") int a,
            @ToolParam(description = "第二个数") int b) {
        return a + b;
    }
}

// 注册到 ChatClient（本次调用可用）
String answer = ChatClient.create(chatModel)
    .prompt("今天日期？")
    .tools(new DateTimeTools())
    .call()
    .content();
```

### 5.2 函数式 Bean 工具（动态，按名调用）

```java
@Configuration(proxyBeanMethods = false)
class WeatherTools {
    public static final String CURRENT_WEATHER_TOOL = "currentWeather";

    @Bean(CURRENT_WEATHER_TOOL)
    @Description("查询指定地点的天气")
    Function<WeatherRequest, WeatherResponse> currentWeather() {
        return weatherService::query;
    }
}

// 按工具名注册
String answer = ChatClient.create(chatModel)
    .prompt("哥本哈根天气怎么样？")
    .toolNames("currentWeather")
    .call()
    .content();
```

### 5.3 工具注册方式总览

| 场景 | ChatClient 方法 |
|---|---|
| 本次调用注册 @Tool 对象 | `.tools(Object...)` |
| 本次调用注册 ToolCallback | `.toolCallbacks(ToolCallback...)` |
| 本次调用注册函数 Bean 名 | `.toolNames(String...)` |
| 全局默认工具（Builder 上） | `.defaultTools(...)` / `.defaultToolCallbacks(...)` / `.defaultToolNames(...)` |

> 工具调用过程中的中间消息**不会**被写入记忆（官方已知限制，1.1 未解决）。

---

## 6. Advisors（顾问链）

Advisor 在每次请求前后对 Prompt 做增强/后处理，是最常用的扩展点。

常用内置 Advisor：

| Advisor | 作用 |
|---|---|
| `MessageChatMemoryAdvisor` | **会话记忆**（把历史消息拼进请求）——推荐 |
| `QuestionAnswerAdvisor` | RAG：检索 VectorStore 并拼上下文 |
| `SimpleLoggerAdvisor` | 打印请求/响应日志 |
| `SafeGuardAdvisor` | 敏感词/合规拦截 |
| `VectorStoreChatMemoryAdvisor` | 用向量库做记忆 |
| `ToolCallingAdvisor` | 工具调用（ChatClient 默认自动注册） |

### 6.1 全局挂载 Advisor

```java
ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
    .defaultAdvisors(new SimpleLoggerAdvisor())
    .build();
```

### 6.2 单次调用传 Advisor 参数

```java
chatClient.prompt()
    .user("继续刚才的话题")
    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
    .call()
    .content();
```

---

## 7. Chat Memory（会话记忆）—— 本项目已落地

### 7.1 记忆三件套

- `ChatMemory`：记忆抽象，`add(convId, msgs)` / `get(convId)` / `clear(convId)`。
- `ChatMemoryRepository`：持久化仓库（InMemory / JDBC / Mongo）。
- `MessageChatMemoryAdvisor`：把记忆接进 ChatClient 的顾问。

### 7.2 用窗口记忆 + 持久化仓库组装

```java
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;

// 内存仓库版（不持久化，重启丢失）
ChatMemory memory = MessageWindowChatMemory.builder()
    .maxMessages(20)                    // 窗口大小，默认 20
    .build();

// JDBC 持久化版（需要 DataSource）
ChatMemoryRepository repo = /* JdbcChatMemoryRepository 或本项目自定义实现 */;
ChatMemory memory = MessageWindowChatMemory.builder()
    .chatMemoryRepository(repo)
    .maxMessages(20)
    .build();

// 接进 ChatClient
ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(MessageChatMemoryAdvisor.builder(memory).build())
    .build();
```

### 7.3 会话隔离（关键）

`ChatMemory.CONVERSATION_ID` 参数**必填**，漏传会抛 `IllegalArgumentException`。用它在每次调用时指定记忆归属的会话：

```java
String conversationId = "007";
chatClient.prompt()
    .user("我有代号吗？")
    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
    .call()
    .content();
```

> **本项目做法**：`LlmModelRouter` 把记忆主键设为 `userId + ":" + conversationId`，跨用户、跨会话隔离；`MessageChatMemoryAdvisor` + 自研 `JdbcChatMessageRepository`（落 `chat_message` 表）。

### 7.4 过时对照

| 过时 | 1.1.x 正确写法 |
|---|---|
| `PromptChatMemoryAdvisor`（1.1.3 起废弃） | `MessageChatMemoryAdvisor` |
| 旧版把历史拼进 system prompt | 以类型化 `Message` 列表传入请求 |

---

## 8. 多模型 / OpenAI 兼容（本项目已在用）

```java
import org.springframework.ai.openai.OpenAiApi;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;

OpenAiApi api = OpenAiApi.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)          // 兼容 DeepSeek / 其它 OpenAI 兼容端点
    .build();

ChatModel model = OpenAiChatModel.builder()
    .openAiApi(api)
    .defaultOptions(OpenAiChatOptions.builder()
        .model(modelCode)
        .build())
    .build();
```

---

## 9. RAG（检索增强，项目 Phase 2 规划）

```java
// VectorStore 注入（如 PgVectorStore）
@Autowired VectorStore vectorStore;

ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(QuestionAnswerAdvisor.builder(vectorStore).build())
    .build();

String answer = chatClient.prompt()
    .user("根据我的知识库回答：...")
    .call()
    .content();
```

---

## 10. 视频过时写法 → 1.1.x 速查对照表

| 视频里的旧写法 | 1.1.x 新写法 | 变化本质 |
|---|---|---|
| `ChatModel` 直接 `call(Prompt)` | `ChatClient.builder(model).prompt().user().call().content()` | 门面化、链式 |
| `FunctionCallback.builder()` | `@Tool` 注解 或 `MethodToolCallback`/`FunctionToolCallback` | 重构为 ToolCallback |
| `PromptChatMemoryAdvisor` | `MessageChatMemoryAdvisor` | 记忆类型化 |
| 记忆无会话隔离 | `advisors(a -> a.param(ChatMemory.CONVERSATION_ID, id))` | 会话隔离必填 |
| `entity()` 泛型写法不规范 | `entity(ParameterizedTypeReference<T>)` | 支持泛型 |
| `spring-ai-model` / `spring-ai-client-chat` 单独引 | 直接用各类 `starter` | 模块合并 |

---

## 11. 官方文档入口速查（1.1.x）

| 主题 | 地址 |
|---|---|
| Chat Client API | `.../reference/1.1.8/api/chatclient.html` |
| Chat Memory | `.../reference/1.1.8/api/chat-memory.html` |
| Tool Calling | `.../reference/1.1/api/tools.html` |
| FunctionCallback→ToolCallback 迁移 | `.../reference/1.1/api/tools-migration.html` |
| 1.1 升级说明 | `.../reference/1.1/upgrade-notes.html` |
