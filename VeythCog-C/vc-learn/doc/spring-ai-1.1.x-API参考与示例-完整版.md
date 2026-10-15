# Spring AI 1.1.x API 参考与示例（完整版）

> 适用版本：Spring AI **1.1.2**（本项目 VeythCog-C 所用），参考文档以官方 **1.1.8** 为准（1.1.x 线内 API 稳定，无逐 patch 文档）。
> 官方文档固定版本入口：`https://docs.spring.io/spring-ai/reference/1.1.8/`（或 `/reference/1.1/`）。
> 本文件面向"跟着过时教学视频学习、用 1.1.x 新写法重写"的场景，重点标注**过时 API → 1.1.x 写法**对照。
> 本完整版在原版 10 章基础上，依据官方 `api/` 目录逐页补齐：ChatModel 底层 API、Structured Output、Tool Calling 全量、Advisors 机制、Vector Store、RAG 模块化架构、ETL 管线、多模态、ChatOptions 与配置项等，并保留本项目已落地的实现备注。

---

## 0. 版本与文档怎么选

- Spring AI 2.0.x 需要 **Spring Boot 4.0/4.1 + Spring Framework 7**，本项目在 Boot 3.5.8 + Spring AI 1.1.2，**不要用 2.0 文档**。
- 1.1.x 稳定版文档对应 **1.1.8** 链接（右上角版本下拉选 `Stable → 1.1.8`）。
- 1.0.x 是上一代，部分 API 位置/写法与 1.1 不同，别混用。
- 打开 1.1.8 页面顶部有"latest stable is 2.0.1"横幅，是引导新项目的，与本项目无关，忽略即可。
- 官方 `reference/1.1/api/` 目录是 1.1 全量 API 的主入口，本章后面的各章与之一一对应。常用子页一览见文末「11. 官方文档入口速查」。

---

## 1. 依赖与自动装配

### 1.1 引入依赖

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

### 1.2 常用官方 starter 与组件依赖速查

| 用途                    | 依赖 artifactId                                              | 说明                                                 |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| OpenAI 兼容接入         | `spring-ai-openai`                                         | OpenAiChatModel / OpenAiEmbeddingModel               |
| 阿里百炼 DashScope      | `spring-ai-alibaba-starter-dashscope`                      | 国产化、本项目在用                                   |
| JDBC 聊天记忆仓库       | `spring-ai-starter-model-chat-memory-repository-jdbc`      | 自动建 SPRING_AI_CHAT_MEMORY 表                      |
| Cassandra 记忆仓库      | `spring-ai-starter-model-chat-memory-repository-cassandra` | 时序 schema                                          |
| Neo4j 记忆仓库          | `spring-ai-starter-model-chat-memory-repository-neo4j`     | 图存储                                               |
| Cosmos DB 记忆仓库      | `spring-ai-starter-model-chat-memory-repository-cosmos-db` | Azure 文档库                                         |
| MongoDB 记忆仓库        | `spring-ai-starter-model-chat-memory-repository-mongodb`   | 文档库                                               |
| RAG Advisor             | `spring-ai-advisors-vector-store`                          | QuestionAnswerAdvisor / VectorStoreChatMemoryAdvisor |
| 模块化 RAG              | `spring-ai-rag`                                            | RetrievalAugmentationAdvisor 及 QueryTransformer 等  |
| PDF 读取                | `spring-ai-pdf-document-reader`                            | Page/Paragraph 两种                                  |
| Tika 多格式读取         | `spring-ai-tika-document-reader`                           | DOCX/PPTX/HTML 等                                    |
| Markdown 读取           | `spring-ai-markdown-document-reader`                       | Markdown 文档解析                                    |
| 向量库（示例 PgVector） | `spring-ai-starter-vector-store-pgvector`                  | Postgres/pgvector                                    |

> 本项目 VeythCog-C 的 JDBC 记忆仓库不依赖官方 starter、自控建表，手写了 `JdbcChatMessageRepository`（实现 `ChatMemoryRepository`）。两种做法等价：官方组件"少写代码"，手写"表结构自己掌控"。见第 7 章。

### 1.3 自动装配产物（Boot 场景）

引入任一 `ChatModel` 的 starter 后，Spring Boot 自动装配会提供：

- 对应模型的 `ChatModel` Bean（如 `dashScopeChatModel` / `OpenAiChatModel`）；
- 一个 **prototype** 作用域的 `ChatClient.Builder` Bean（可直接注入、可多次 `build()` 出独立 ChatClient）；
- 若启用，还会自动装配 `EmbeddingModel`、`VectorStore`、`ChatMemory`、`ChatMemoryRepository` 等。

> 需要同时使用多个模型类型时，通过 `spring.ai.chat.client.enabled=false` 关闭 `ChatClient.Builder` 自动装配，再手动按模型创建。见 2.1.2。

---

## 2. ChatModel vs ChatClient（核心）

- **ChatModel**：底层模型抽象，`chatModel.call(prompt)` 直接调用，返回 `ChatResponse`；`stream(prompt)` 返回 `Flux<ChatResponse>`。
- **ChatClient**：推荐的链式门面，封装 Prompt、Advisors、Structured Output、Tools、模板渲染，内部还是走 ChatModel。

### 2.0 底层 ChatModel API（补齐）

官方 1.1 中 `ChatModel` 接口（包 `org.springframework.ai.chat.model`）核心方法：

```java
public interface ChatModel extends Model<Prompt, ChatResponse> {
    ChatResponse call(Prompt prompt);                 // 同步
    Flux<ChatResponse> stream(Prompt prompt);          // 响应式流式
    default String generate(String message) { ... }     // 便捷：纯文本
}
```

- `ChatResponse` 由多个 `Generation` 组成，每个 `Generation` 内含一个 `AssistantMessage`（其 `getOutput()` / `getText()` 可取文本）以及 `ChatGenerationMetadata`（含 token 用量等）。
- `ChatOptions`（及其模型子类，如 `OpenAiChatOptions`、`DashScopeChatOptions`）承载模型名、temperature、maxTokens、topP、tools、responseFormat 等选项，既可在 `Prompt` 中按次传，也可在模型 Builder 上作 `defaultOptions`。

底层手动调用示例（与 ChatClient 等价但更啰嗦）：

```java
Prompt prompt = new Prompt("今天天气怎么样？");
ChatResponse resp = chatModel.call(prompt);
String text = resp.getResult().getOutput().getText();   // 取首个生成结果文本
```

> 结论：业务代码建议一律走 ChatClient；只有需要精细控制选项或复用底层能力（如自定义 Advisor、RAG 模块）时才直接用 ChatModel。

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

#### 2.1.1 多 ChatClient、单模型类型

禁用自动装配后手动创建多个，各自带不同默认配置：

```java
ChatModel myChatModel = ...;
ChatClient.Builder builder = ChatClient.builder(myChatModel);
ChatClient custom = builder
    .defaultSystemPrompt("You are a helpful assistant.")
    .build();
```

#### 2.1.2 多模型类型（各一个 ChatClient Bean）

```java
@Configuration class ChatClientConfig {
    @Bean ChatClient openAiChatClient(OpenAiChatModel chatModel) {
        return ChatClient.create(chatModel);
    }
    @Bean ChatClient anthropicChatClient(AnthropicChatModel chatModel) {
        return ChatClient.create(chatModel);
    }
}
// 使用处用 @Qualifier 区分
@Qualifier("openAiChatClient") ChatClient openAiChatClient
```

#### 2.1.3 多 OpenAI 兼容端点：mutate()

`OpenAiApi` 与 `OpenAiChatModel` 提供 `mutate()` 派生新实例，适合对接多个 OpenAI 兼容 API（Groq、DeepSeek、本地 vLLM 等）：

```java
OpenAiApi groqApi = baseOpenAiApi.mutate()
    .baseUrl("https://api.groq.com/openai")
    .apiKey(System.getenv("GROQ_API_KEY"))
    .build();
OpenAiChatModel groqModel = baseChatModel.mutate()
    .openAiApi(groqApi)
    .defaultOptions(OpenAiChatOptions.builder().model("llama3-70b-8192").temperature(0.5).build())
    .build();
```

### 2.2 基本调用（同步）

```java
String answer = chatClient.prompt()
    .user("今天天气怎么样？")
    .call()
    .content();
```

### 2.3 流式调用（异步，返回 Flux<String></string>）

```java
Flux<String> flux = chatClient.prompt()
    .user("讲个笑话")
    .stream()
    .content();
```

> **流式依赖 WebFlux**：流式只走 Reactor 栈，纯 Servlet 工程需引入 `spring-boot-starter-webflux`；反之非流式需 Servlet 栈（`spring-boot-starter-web`）。工具调用是命令式的，会阻塞流式链路，并导致 Micrometer span 部分中断（官方已知）。

### 2.4 携带系统消息 / 参数

```java
String answer = chatClient.prompt()
    .system("你是一个资深的 Java 后端工程师")
    .user(u -> u.text("请解释 {concept}")
        .param("concept", "Spring AI Advisor"))
    .call()
    .content();
```

### 2.5 prompt() 的三种入口（补齐）

`ChatClient` 的 `prompt()` 有三个重载，用于开启流式 API：

```java
// ① 无参：手动拼 user/system/options
chatClient.prompt().user(...).system(...).call().content();
// ② 传入现成 Prompt 实例
Prompt prompt = new Prompt("...");
chatClient.prompt(prompt).call().content();
// ③ 便捷：直接把用户文本作为 user 消息
chatClient.prompt("今天天气").call().content();
```

### 2.6 call() 的返回值形态

| 方法                                    | 返回                   | 用途                                    |
| --------------------------------------- | ---------------------- | --------------------------------------- |
| `content()`                           | `String`             | 只要回复文本                            |
| `chatResponse()`                      | `ChatResponse`       | 带元数据（token 用量、generation）      |
| `chatClientResponse()`                | `ChatClientResponse` | 含 Advisor 执行上下文（RAG 命中文档等） |
| `entity(Class)`                       | `T`                  | 结构化输出                              |
| `entity(ParameterizedTypeReference)`  | `T`                  | 泛型结构化输出                          |
| `entity(StructuredOutputConverter)`   | `T`                  | 用自定义转换器                          |
| `responseEntity(Class/.../Converter)` | `ResponseEntity`     | 同时要 ChatResponse + 对象              |

### 2.7 stream() 的返回值形态（补齐）

| 方法                                              | 返回                      |
| ------------------------------------------------- | ------------------------- |
| `Flux<String> content()`                        | 流式文本                  |
| `Flux<ChatResponse> chatResponse()`             | 流式完整响应（含元数据）  |
| `Flux<ChatClientResponse> chatClientResponse()` | 流式响应 + Advisor 上下文 |

> **重要**：`call()` / `stream()` 只是指示同步或异步执行，真正的模型调用发生在随后调用 `content()` / `chatResponse()` / `entity()` 等"终结方法"时才触发。

### 2.8 Prompt 模板与 TemplateRenderer（补齐）

`ChatClient` 内部用 `PromptTemplate` 处理 user/system 文本，依赖 `TemplateRenderer`：

- 默认 `StTemplateRenderer`（基于 StringTemplate 引擎，变量语法 `{var}`）；
- `NoOpTemplateRenderer`：完全不做模板处理；
- 可用 `.templateRenderer()` 自定义渲染器，甚至改分隔符以兼容 JSON 中的 `{}`：

```java
String answer = ChatClient.create(chatModel).prompt()
    .user(u -> u.text("Tell me the names of 5 movies by <composer>")
        .param("composer", "John Williams"))
    .templateRenderer(StTemplateRenderer.builder()
        .startDelimiterToken('<').endDelimiterToken('>').build())
    .call().content();
```

> 注意：`.templateRenderer()` 只影响 ChatClient 链上直接写的 `.user()/.system()` 模板，**不影响** Advisor 内部模板（如 QuestionAnswerAdvisor，其有自己的模板定制机制）。

### 2.9 消息元数据 Metadata（补齐）

user/system 消息都支持附加元数据，供 Advisor 或下游处理读取：

```java
// 逐条加
chatClient.prompt()
    .user(u -> u.text("What's the weather?")
        .metadata("messageId", "msg-123")
        .metadata("userId", "user-456"))
    .system(s -> s.text("You are helpful").metadata("version", "1.0"))
    .call().content();

// 一次加一个 Map
Map<String,Object> meta = Map.of("messageId","msg-123","ts",System.currentTimeMillis());
chatClient.prompt().user(u -> u.text("hi").metadata(meta)).call().content();
```

- 可在 `ChatClient.Builder` 用 `.defaultSystem(Consumer)` / `.defaultUser(Consumer)` 配置**默认元数据**。
- 校验规则：key 不能为 null/空串、value 不能为 null、Map 中 key/value 均不能含 null，否则抛 `IllegalArgumentException`。
- 读取：生成的 `UserMessage`/`SystemMessage` 上 `getMetadata()` 可取。

### 2.10 使用默认值（Defaults，补齐）

在 `@Configuration` 中设置默认，运行时只需给 user 文本：

```java
@Bean ChatClient chatClient(ChatClient.Builder builder) {
    return builder.defaultSystem("You are a friendly chat bot that answers in the voice of a {voice}")
        .build();
}
// 运行时用 .system(sp -> sp.param("voice", voice)) 覆盖占位
```

Builder 级其它默认方法（均有对应的运行时无前缀覆盖方法）：

| 默认                                       | 运行时覆盖                          | 说明                       |
| ------------------------------------------ | ----------------------------------- | -------------------------- |
| `defaultOptions(ChatOptions)`            | `options(ChatOptions)`            | 默认选项（便携或模型专属） |
| `defaultFunction(name, desc, Function)`  | `function(...)`                   | 默认函数工具               |
| `defaultFunctions(String...names)`       | `functions(String...)`            | 默认函数 Bean 名           |
| `defaultUser(text/Resource/Consumer)`    | `user(...)`                       | 默认 user 文本             |
| `defaultSystem(text)`                    | `system(...)`                     | 默认 system 文本           |
| `defaultAdvisors(Advisor...)`            | `advisors(...)`                   | 默认顾问                   |
| `defaultAdvisors(Consumer<AdvisorSpec>)` | `advisors(Consumer<AdvisorSpec>)` | 批量配置顾问               |
| `defaultToolCallbacks(...)`              | `toolCallbacks(...)`              | 默认工具回调               |
| `defaultTools(...)`                      | `tools(...)`                      | 默认 @Tool 对象            |
| `defaultToolNames(...)`                  | `toolNames(...)`                  | 默认函数 Bean 名           |

---

## 3. Messages（消息类型，补齐）

```java
import org.springframework.ai.chat.messages.*;

UserMessage u = new UserMessage("你好");           // 用户消息
AssistantMessage a = new AssistantMessage("你好");  // 助手消息
SystemMessage s = new SystemMessage("你是助手");     // 系统消息
MessageType type = u.getMessageType();              // USER / ASSISTANT / SYSTEM / TOOL
String text = u.getText();                          // 取文本
```

### 3.1 消息类型全集

| 类                      | MessageType | 用途                                           |
| ----------------------- | ----------- | ---------------------------------------------- |
| `UserMessage`         | USER        | 用户输入                                       |
| `SystemMessage`       | SYSTEM      | 系统指令                                       |
| `AssistantMessage`    | ASSISTANT   | 助手回复（可含 ToolCall 列表）                 |
| `ToolResponseMessage` | TOOL        | 工具执行结果                                   |
| `ToolCallMessage`     | TOOL        | 模型发起的工具调用（1.0 曾用 FunctionMessage） |

> 注意：取文本用的是 `getText()`（`Message` 继承自 `Content`），**没有** `getContent()`。

### 3.2 多模态消息（补齐）

`UserMessage` 支持携带多模态内容（图片/音频/视频），通过 `Media` 对象：

```java
Media image = new Media(MimeTypeUtils.parseMimeType("image/png"), imageUrl);
UserMessage um = new UserMessage("描述这张图片", List.of(image));
// ChatClient 链式写法
chatClient.prompt()
    .user(u -> u.text("这是什么？").media(MimeTypeUtils.parseMimeType("image/png"), imageUrl))
    .call().content();
```

- `Media` 构造参数为 (MIME 类型, data) 或 (MIME 类型, URI)。data 可为字节数组、URL 或 Base64。
- 是否真正支持多模态取决于底层模型（OpenAI 4o、Gemini、Qwen-VL 等）。`AbstractMessageOutputConverter` 提供将 LLM 输出（含媒体）转成消息的能力，用于多模态结构化输出场景。

---

## 4. Prompt 与模板（补齐）

```java
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.chat.messages.Message;

PromptTemplate pt = new PromptTemplate("请用一句话解释 {topic}");
Prompt prompt = pt.create(Map.of("topic", "依赖注入"));

// 或用 ChatClient 内联模板（推荐）
String answer = chatClient.prompt()
    .user(u -> u.text("用一句话解释 {topic}").param("topic", "AOP"))
    .call().content();
```

### 4.1 Prompt 组成（补齐）

`Prompt` = 若干 `Message`（消息列表）+ `ChatOptions`：

```java
Prompt p = new Prompt(
    List.of(new SystemMessage("你是助手"), new UserMessage("你好")),
    OpenAiChatOptions.builder().temperature(0.5).build()
);
// 常用方法
List<Message> msgs = p.getInstructions();
ChatOptions opts = p.getOptions();
```

### 4.2 PromptTemplate Builder 式（补齐）

```java
Prompt prompt = PromptTemplate.builder()
    .template("用一句话解释 {topic}")       // 模板文本
    .variables(Map.of("topic", "AOP"))     // 变量
    .build().create();                      // 或 createMessage() 只取单条消息

Message msg = PromptTemplate.builder()
    .template("系统：{role}")                // 可指定 role
    .build().createMessage();
```

### 4.3 模板引擎选择

- `StTemplateRenderer`（默认，StringTemplate 引擎）：`{var}` 语法。
- `NoOpTemplateRenderer`：跳过渲染。
- `PromptTemplate.builder().renderer(...)`：注入自定义渲染器。
- 模板可在 `Resource`（classpath 文件）中维护：`new PromptTemplate(resource)`。

---

## 5. Structured Output（结构化输出，补齐）

> 1.0 时代没有独立的 `entity()`/Converter 统一文档；1.1 以 `StructuredOutputConverter` 为核心，配合 ChatClient 的 `entity()` 快速使用。

### 5.1 核心接口

```java
public interface StructuredOutputConverter<T> extends Converter<String, T>, FormatProvider { }
public interface FormatProvider { String getFormat(); }
```

- **调用前**：`getFormat()` 产出格式指令（JSON Schema / 分隔符说明）追加到用户提示的 `{format}` 占位处。
- **调用后**：`convert(String)` 把模型文本输出转成目标类型 T。
- 这是"尽力而为"，模型不保证一定产出合法结构，建议自行做校验。
- StructuredOutputConverter **不用于** Tool Calling（工具调用天然结构化）。

### 5.2 内置转换器

| 转换器                                          | 说明                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `BeanOutputConverter<T>`                      | 由 Java 类/Record 生成 DRAFT_2020_12 JSON Schema，用 ObjectMapper 反序列化 |
| `MapOutputConverter`                          | 引导模型输出 RFC8259 JSON，转成`Map<String,Object>`                      |
| `ListOutputConverter`                         | 引导逗号分隔列表，经 ConversionService 转成`List`                        |
| `AbstractConversionServiceOutputConverter<T>` | 预配 GenericConversionService，无默认 FormatProvider                       |
| `AbstractMessageOutputConverter<T>`           | 预配 MessageConverter（多模态），无默认 FormatProvider                     |

### 5.3 高层用法：ChatClient.entity()

```java
record ActorFilms(String actor, List<String> movies) {}

ActorFilms films = chatClient.prompt()
    .user("给汤姆·汉克斯列出 5 部电影")
    .call()
    .entity(ActorFilms.class);

// 泛型集合
List<ActorFilms> list = chatClient.prompt()
    .user("...")
    .call()
    .entity(new ParameterizedTypeReference<List<ActorFilms>>() {});

// Map
Map<String,Object> m = chatClient.prompt()
    .user(u -> u.text("Provide a List of {subject}")
        .param("subject", "an array of numbers from 1 to 9 under the key 'numbers'"))
    .call()
    .entity(new ParameterizedTypeReference<Map<String,Object>>() {});

// List（配合 ListOutputConverter）
List<String> flavors = chatClient.prompt()
    .user(u -> u.text("List five {subject}").param("subject", "ice cream flavors"))
    .call()
    .entity(new ListOutputConverter(new DefaultConversionService()));
```

### 5.4 低层用法：ChatModel + Converter

```java
BeanOutputConverter<ActorFilms> converter = new BeanOutputConverter<>(ActorFilms.class);
String format = converter.getFormat();
String template = """
    Generate the filmography of 5 movies for {actor}.
    {format}
    """;
Generation gen = chatModel.call(
    PromptTemplate.builder().template(template)
        .variables(Map.of("actor","Tom Hanks","format",format))
        .build().create()).getResult();
ActorFilms films = converter.convert(gen.getOutput().getText());
```

### 5.5 属性排序：@JsonPropertyOrder（补齐）

`BeanOutputConverter` 支持 `@JsonPropertyOrder` 控制生成 JSON Schema 的属性顺序，Record 与普通类均可用：

```java
@JsonPropertyOrder({"actor", "movies"})
record ActorFilms(String actor, List<String> movies) {}
```

### 5.6 Native Structured Output（原生结构化输出，补齐）

开启 `AdvisorParams.ENABLE_NATIVE_STRUCTURED_OUTPUT` 后，`BeanOutputConverter` 生成的 JSON Schema 直接发给模型的原生结构化输出接口，**不再往提示里拼格式指令**，可靠性更高：

```java
ActorFilms films = chatClient.prompt()
    .advisors(AdvisorParams.ENABLE_NATIVE_STRUCTURED_OUTPUT)
    .user("Generate the filmography for a random actor.")
    .call()
    .entity(ActorFilms.class);
// 全局开启：builder.defaultAdvisors(AdvisorParams.ENABLE_NATIVE_STRUCTURED_OUTPUT)
```

支持原生结构化输出的模型：OpenAI（GPT-4o 起）、Anthropic（Claude 3.5 Sonnet 起）、Vertex AI Gemini（Gemini 1.5 Pro 起）、Mistral（Small 起）。注意 OpenAI 原生不支持顶层对象数组，此时回退到普通转换。

### 5.7 内置 JSON 模式（补齐）

- OpenAI：`spring.ai.openai.chat.options.responseFormat`（JSON_OBJECT / JSON_SCHEMA）。
- Azure OpenAI / Mistral：同样 `responseFormat` 设为 `{"type":"json_object"}` 开启 JSON 模式。
- Ollama：`spring.ai.ollama.chat.options.format=json`。
- 这些是与 Native Structured Output 并列的另一条路（模型专属配置）。

---

## 6. Tool / Function Calling（工具调用，补齐）

> 1.0 时代叫 **Function Calling / FunctionCallback**，1.1 重构为 **Tool Calling / ToolCallback**。
> 迁移对照：`FunctionCallback` → `ToolCallback`；`@Tool` 声明式最常用。

### 6.1 工具调用机制总览

- 工具以 `ToolCallback` 接口建模：含**定义**（name/description/inputSchema）与**执行逻辑**。
- `ChatModel` 实现通过 `ToolCallingManager` 透明地把模型的工具调用请求派发到对应 `ToolCallback`，并把执行结果回传给模型以生成最终回复。
- 工具可（1）直接传 `ToolCallback` 列表，或（2）传工具名由 `ToolCallbackResolver` 动态解析。
- 六步链路：① 带工具定义发给模型 → ② 模型回传工具名+参数 → ③ 应用按名执行工具 → ④ 处理结果 → ⑤ 结果回传模型 → ⑥ 模型生成最终回答。

### 6.2 ToolCallback 接口（补齐）

```java
public interface ToolCallback {
    ToolDefinition getToolDefinition();          // 定义（name/description/inputSchema）
    ToolMetadata getToolMetadata();              // 附加设置（returnDirect、resultConverter）
    String call(String toolInput);               // 执行
    String call(String toolInput, ToolContext context);
}
```

- `ToolDefinition`：`name()`、`description()`、`inputSchema()`（JSON Schema 字符串）。
- `ToolMetadata`：`returnDirect()`（是否直返调用者）、`resultConverter()`。
- 内置实现：`MethodToolCallback`（方法）、`FunctionToolCallback`（函数）。

### 6.3 声明式 @Tool（推荐）

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

String answer = ChatClient.create(chatModel)
    .prompt("今天日期？")
    .tools(new DateTimeTools())
    .call()
    .content();
```

**@Tool 注解属性**：

- `name`：工具名，缺省用方法名。同一请求内工具名必须唯一。
- `description`：工具用途描述，强烈建议详细写——写不好模型可能不调用或误调用。
- `returnDirect`：结果是否直返客户端（见 6.8）。
- `resultConverter`：指定 `ToolCallResultConverter` 实现类。

**@ToolParam 注解属性**：

- `description`：参数说明（格式、允许值等）。
- `required`：是否必填，默认必填；若参数标了 `@Nullable` 且未显式 required，则视为可选。

**其它可用的参数/返回注解**：Swagger `@Schema`、Jackson `@JsonProperty` 也参与生成 JSON Schema。

**方法约束**：

- 方法可为 static/instance、任意可见性；方法所在类可为顶层/嵌套类、任意可见性。
- 参数支持 primitive/POJO/enum/list/array/map 等；返回多数类型（含 `void`）；有返回值时返回类型须可序列化（结果会序列化回传模型）。
- 作为 Spring Bean（如 `@Component`）时，`@Tool` 方法可被 AOT 编译；否则需给 GraalVM 提供反射配置。

### 6.4 程序化：MethodToolCallback

```java
Method method = ReflectionUtils.findMethod(DateTimeTools.class, "getCurrentDateTime");
ToolCallback tc = MethodToolCallback.builder()
    .toolDefinition(ToolDefinitions.builder(method)
        .description("Get the current date and time").build())
    .toolMethod(method)
    .toolObject(new DateTimeTools())   // static 方法可省略
    .build();
```

**ToolDefinition.Builder** 属性：`name`、`description`、`inputSchema`（缺省按方法参数自动生成）。

**ToolMetadata.Builder** 属性：`returnDirect`。

### 6.5 程序化：FunctionToolCallback

```java
public record WeatherRequest(String location, Unit unit) {}
public record WeatherResponse(double temp, Unit unit) {}
public enum Unit { C, F }

ToolCallback tc = FunctionToolCallback
    .builder("currentWeather", (Function<WeatherRequest,WeatherResponse>) weatherService::query)
    .description("Get the weather in location")
    .inputType(WeatherRequest.class)
    .build();
```

- 函数可为 `Function`/`Supplier`/`Consumer`/`BiFunction`；输入/输出可为 `Void` 或 POJO，须可序列化；函数与输入输出类型须为 public。

### 6.6 函数式 Bean 工具（动态，按名调用，补齐）

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

String answer = ChatClient.create(chatModel)
    .prompt("哥本哈根天气怎么样？")
    .toolNames("currentWeather")
    .call()
    .content();
```

### 6.7 工具注册方式总览（补齐）

| 场景                       | ChatClient 方法                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------ |
| 本次调用注册 @Tool 对象    | `.tools(Object...)`                                                                |
| 本次调用注册 ToolCallback  | `.toolCallbacks(ToolCallback...)`                                                  |
| 本次调用注册函数 Bean 名   | `.toolNames(String...)`                                                            |
| 全局默认工具（Builder 上） | `.defaultTools(...)` / `.defaultToolCallbacks(...)` / `.defaultToolNames(...)` |
| 底层 ChatModel 按次传      | `ToolCallingChatOptions.builder().toolCallbacks(...)`                              |
| 底层 ChatModel 默认工具    | 模型构建时`defaultOptions(ToolCallingChatOptions...toolCallbacks)`                 |

> 若同时提供默认工具与运行时工具，运行时工具**完全覆盖**默认工具。
> `ToolCallbacks` 工具类：`ToolCallback[] tcs = ToolCallbacks.from(new DateTimeTools());` 由 `@Tool` 方法批量生成。

### 6.8 结果直接返回 returnDirect（补齐）

默认工具结果回传模型继续对话；当结果应直接返回调用者时（如 RAG 工具、终止推理循环），设置 `returnDirect`：

```java
@Tool(description = "Retrieve customer info", returnDirect = true)
Customer getCustomerInfo(Long id) { ... }

// 程序化
ToolMetadata md = ToolMetadata.builder().returnDirect(true).build();
```

> 若一次并发发起多个工具调用，要"全部 returnDirect"才能全部直返；否则仍回传模型。

### 6.9 结果转换 ToolCallResultConverter（补齐）

```java
@FunctionalInterface
public interface ToolCallResultConverter {
    String convert(@Nullable Object result, @Nullable Type returnType);
}
```

- 默认 `DefaultToolCallResultConverter` 用 Jackson 序列化为 JSON。
- `@Tool` 用 `resultConverter = CustomConverter.class`；程序化用 Builder 的 `toolCallResultConverter(...)`。

### 6.10 用户控制的工具执行（补齐）

默认框架自动循环执行工具（framework-controlled）。也可 `internalToolExecutionEnabled(false)` 关闭，自行控制（配合 ChatMemory 保存工具中间消息——官方默认不存这些消息）：

```java
ToolCallingManager tcm = DefaultToolCallingManager.builder().build();
ChatMemory chatMemory = MessageWindowChatMemory.builder().build();
String convId = UUID.randomUUID().toString();

ChatOptions opts = ToolCallingChatOptions.builder()
    .toolCallbacks(ToolCallbacks.from(new MathTools()))
    .internalToolExecutionEnabled(false)
    .build();
Prompt prompt = new Prompt(List.of(new SystemMessage("You are helpful"),
    new UserMessage("What is 6 * 8?")), opts);
chatMemory.add(convId, prompt.getInstructions());

ChatResponse resp = chatModel.call(new Prompt(chatMemory.get(convId), opts));
chatMemory.add(convId, resp.getResult().getOutput());

while (resp.hasToolCalls()) {
    ToolExecutionResult tr = tcm.executeToolCalls(new Prompt(chatMemory.get(convId), opts), resp);
    // 把工具调用结果（conversationHistory 末尾）写入记忆
    var hist = tr.conversationHistory();
    chatMemory.add(convId, hist.get(hist.size()-1));
    resp = chatModel.call(new Prompt(chatMemory.get(convId), opts));
    chatMemory.add(convId, resp.getResult().getOutput());
}
```

### 6.11 动态工具解析 ToolCallbackResolver（补齐）

```java
public interface ToolCallbackResolver {
    @Nullable ToolCallback resolve(String toolName);
}
```

- 默认 `DelegatingToolCallbackResolver` 委派给：
  - `SpringBeanToolCallbackResolver`：从 Spring 容器按类型（Function/Supplier/Consumer/BiFunction）解析 Bean。
  - `StaticToolCallbackResolver`：从静态 ToolCallback 列表解析（Boot 自动配置会把所有 `ToolCallback` Bean 汇集给它）。
- 可自定义 Bean 覆盖解析逻辑：

```java
@Bean ToolCallbackResolver toolCallbackResolver(List<FunctionCallback> cbs) {
    return new DelegatingToolCallbackResolver(List.of(new StaticToolCallbackResolver(cbs)));
}
```

### 6.12 工具参数增强（Tool Argument Augmentation，1.1 新特性，补齐）

在不改底层工具实现的前提下，给工具输入 Schema 追加额外字段（捕获推理、元数据、多智能体信号等）：

```java
public record AgentThinking(
    @ToolParam(description = "Your reasoning", required = true) String innerThought,
    @ToolParam(description = "Confidence", required = false) String confidence) {}

AugmentedToolCallbackProvider<AgentThinking> provider = AugmentedToolCallbackProvider
    .<AgentThinking>builder()
    .toolObject(new MyTools())
    .argumentType(AgentThinking.class)
    .argumentConsumer(event -> {
        AgentThinking t = event.arguments();
        log.info("Tool: {} | Reasoning: {}", event.toolDefinition().name(), t.innerThought());
    })
    .removeExtraArgumentsAfterProcessing(true)
    .build();

ChatClient chatClient = ChatClient.builder(chatModel).defaultToolCallbacks(provider).build();
```

- 核心组件：`AugmentedToolCallbackProvider<T>`（包装工具对象）、`AugmentedToolCallback<T>`（包装单个 ToolCallback）、`AugmentedArgumentEvent<T>`（含 toolDefinition/rawInput/arguments）、`ToolInputSchemaAugmenter`（底层 schema 操作）。
- LLM 看到的是增强后的 schema；你的消费者收到 `AgentThinking`；原工具只收自己预期的参数。

> 工具调用过程中的中间消息**不会**被写入记忆（官方已知限制，1.1 未解决），除非走 6.10 用户控制执行。

---

## 7. Advisors（顾问链，补齐）

Advisor 在每次请求前后对 Prompt 做增强/后处理，是最常用的扩展点。

### 7.1 内置 Advisor 总览（补齐）

| Advisor                          | 作用                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `MessageChatMemoryAdvisor`     | **会话记忆**（把历史以类型化 Message 拼进请求）——推荐 |
| `PromptChatMemoryAdvisor`      | 记忆拼进 system prompt（1.1.3 起废弃）                        |
| `VectorStoreChatMemoryAdvisor` | 用向量库做记忆                                                |
| `QuestionAnswerAdvisor`        | 朴素 RAG：检索 VectorStore 并拼上下文                         |
| `RetrievalAugmentationAdvisor` | 模块化 RAG（见第 9 章）                                       |
| `SimpleLoggerAdvisor`          | 打印请求/响应日志                                             |
| `ReReadingAdvisor`             | RE2 重读增强推理                                              |
| `SafeGuardAdvisor`             | 敏感词/合规拦截                                               |
| `ToolCallingAdvisor`           | 工具调用（ChatClient 默认自动注册）                           |

### 7.2 全局挂载 Advisor

```java
ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
    .defaultAdvisors(new SimpleLoggerAdvisor())
    .build();
```

### 7.3 单次调用传 Advisor 参数

```java
chatClient.prompt()
    .user("继续刚才的话题")
    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
    .call()
    .content();
```

`AdvisorSpec` 接口（补齐）：

```java
interface AdvisorSpec {
    AdvisorSpec param(String k, Object v);
    AdvisorSpec params(Map<String,Object> p);
    AdvisorSpec advisors(Advisor... advisors);
    AdvisorSpec advisors(List<Advisor> advisors);
}
```

> Advisor 添加顺序决定执行顺序：链上的改动会传递给下一个。例如 `MessageChatMemoryAdvisor` 先加历史，`QuestionAnswerAdvisor` 再基于用户问题+历史检索，结果更相关。

### 7.4 Advisor 机制：核心组件与接口（补齐）

- 包 `org.springframework.ai.chat.client.advisor.api`。
- 组件：`CallAdvisor` + `CallAdvisorChain`（同步）、`StreamAdvisor` + `StreamAdvisorChain`（流式）、`ChatClientRequest`（未密封的 Prompt 请求）、`ChatClientResponse`（响应）。请求与响应都带 `advise-context`（上下文 Map）跨 Advisor 共享状态。
- 顶层 `Advisor extends Ordered`，有 `getName()`；`getOrder()` 决定执行顺序。

```java
public interface CallAdvisor extends Advisor {
    ChatClientResponse adviseCall(ChatClientRequest req, CallAdvisorChain chain);
}
public interface StreamAdvisor extends Advisor {
    Flux<ChatClientResponse> adviseStream(ChatClientRequest req, StreamAdvisorChain chain);
}
public interface CallAdvisorChain extends AdvisorChain {
    ChatClientResponse nextCall(ChatClientRequest req);
}
```

### 7.5 执行顺序（Order）语义（补齐）

- order 越小越先执行（request 阶段），响应阶段反向回卷（栈式）。
- 第一个执行的 Advisor 最先处理请求、最后处理响应。
- `Ordered.HIGHEST_PRECEDENCE`（Integer.MIN_VALUE）→ 最先处理请求/最后处理响应；`LOWEST_PRECEDENCE`（Integer.MAX_VALUE）→ 反之。
- order 相同 → 顺序不保证。末尾的"内部 Advisor"负责真正调用 LLM。

### 7.6 请求/响应处理链路（补齐）

1. 框架从用户 `Prompt` 创建 `ChatClientRequest` + 空 `context`。
2. 链上每个 Advisor 处理请求、可能改写；也可不调 next 而拦截（此时须自行填好响应）。
3. 框架提供的末尾 Advisor 把请求发给 `ChatModel`。
4. 模型响应沿链回传，转成 `ChatClientResponse`（含共享 context）。
5. 每个 Advisor 处理/改写响应。
6. 最终 `ChatClientResponse` 提取出 `ChatResponse` 返回客户端。

### 7.7 自定义 Advisor 示例（补齐）

**日志型（CallAdvisor + StreamAdvisor，只观察不改写）**：

```java
public class SimpleLoggerAdvisor implements CallAdvisor, StreamAdvisor {
    private static final Logger logger = LoggerFactory.getLogger(SimpleLoggerAdvisor.class);
    @Override public String getName() { return this.getClass().getSimpleName(); }
    @Override public int getOrder() { return 0; }

    @Override public ChatClientResponse adviseCall(ChatClientRequest req, CallAdvisorChain chain) {
        logger.debug("request: {}", req);
        ChatClientResponse resp = chain.nextCall(req);
        logger.debug("response: {}", resp);
        return resp;
    }

    @Override public Flux<ChatClientResponse> adviseStream(ChatClientRequest req, StreamAdvisorChain chain) {
        logger.debug("request: {}", req);
        Flux<ChatClientResponse> resp = chain.nextStream(req);
        // MessageAggregator 把 Flux 聚合成单一响应用于日志（只读，不可改写）
        return new ChatClientMessageAggregator().aggregateChatClientResponse(resp, r -> logger.debug("response: {}", r));
    }
}
```

**RE2 重读型（before/after 模板）**：

```java
public class ReReadingAdvisor implements BaseAdvisor {
    private static final String TEMPLATE = """
        {re2_input_query}
        Read the question again: {re2_input_query}
        """;
    private final String template; private int order = 0;
    // 构造器、getOrder、withOrder 略
    @Override public ChatClientRequest before(ChatClientRequest req, AdvisorChain chain) {
        String augmented = PromptTemplate.builder()
            .template(template)
            .variables(Map.of("re2_input_query", req.prompt().getUserMessage().getText()))
            .build().render();
        return req.mutate().prompt(req.prompt().augmentUserMessage(augmented)).build();
    }
    @Override public ChatClientResponse after(ChatClientResponse resp, AdvisorChain chain) { return resp; }
}
```

### 7.8 流式 vs 非流式（补齐）

- 非流式 Advisor 处理完整 request/response；流式用 Reactor（Flux）。
- 流式示例：

```java
@Override public Flux<ChatClientResponse> adviseStream(ChatClientRequest req, StreamAdvisorChain chain) {
    return Mono.just(req)
        .publishOn(Schedulers.boundedElastic())
        .map(r -> { /* before next */ return r; })
        .flatMapMany(chain::nextStream)
        .map(r -> { /* after next */ return r; });
}
```

### 7.9 Best Practices 与破坏性变更（补齐）

Best Practices：

1. Advisor 职责单一、模块化；2. 用 `adviseContext` 共享状态；3. 尽量同时实现同步+流式；4. 谨慎排 order。

破坏性变更时间线（了解即可）：

- 1.0 M2：`RequestAdvisor`/`ResponseAdvisor`（独立接口）。
- 1.0 M3：改为 `CallAroundAdvisor`/`StreamAroundAdvisor`；移除 `StreamResponseMode`；context 并入 `AdvisedRequest/AdvisedResponse` 且不可变，用 `updateContext` 生成新 map。
- 1.0.0 起：改名为 `CallAdvisor`/`StreamAdvisor`/`CallAdvisorChain`/`StreamAdvisorChain`；`AdvisedRequest → ChatClientRequest`、`AdvisedResponse → ChatClientResponse`。

### 7.10 SimpleLoggerAdvisor 定制（补齐）

```java
logging.level.org.springframework.ai.chat.client.advisor=DEBUG
```

定制打印内容：

```java
SimpleLoggerAdvisor customLogger = new SimpleLoggerAdvisor(
    request -> "Custom request: " + request.prompt().getUserMessage(),
    response -> "Custom response: " + response.getResult(),
    0   // order
);
```

> 生产环境注意别把敏感信息写进日志。

---

## 8. Chat Memory（会话记忆，补齐）—— 本项目已落地

### 8.1 记忆 vs 历史（重要概念，补齐）

- **Chat Memory**：模型为维持当前对话语境所保留的信息。
- **Chat History**：完整对话记录（所有消息）。
- `ChatMemory` 抽象管理的是**记忆**，不推荐用于存全量历史；若需完整留存请用 Spring Data 等自行存储。

### 8.2 记忆三件套

- `ChatMemory`：记忆抽象，`add(convId, msgs)` / `get(convId)` / `clear(convId)`。
- `ChatMemoryRepository`：持久化仓库（InMemory / JDBC / Mongo / Cassandra / Neo4j / CosmosDB）。
- `MessageChatMemoryAdvisor`：把记忆接进 ChatClient 的顾问。

### 8.3 记忆类型：MessageWindowChatMemory

`MessageWindowChatMemory` 维护固定窗口（默认 20 条）。超限时逐出最旧消息但**保留 system 消息**；若加入新 system 消息，旧的 system 消息会被全部移除，保证最新上下文可用、内存有界。

```java
MessageWindowChatMemory memory = MessageWindowChatMemory.builder()
    .maxMessages(20)            // 窗口大小，默认 20
    .build();
```

这是 Spring AI 自动装配 `ChatMemory` Bean 时采用的默认实现。

### 8.4 记忆仓库 ChatMemoryRepository

仓库只负责存取消息；由 `ChatMemory` 决定保留/移除策略。

**8.4.1 In-Memory（默认）**

```java
ChatMemoryRepository repo = new InMemoryChatMemoryRepository();  // ConcurrentHashMap 实现
```

Boot 无其它仓库时自动装配此类型。

**8.4.2 Jdbc（持久化，重点）**

依赖：`spring-ai-starter-model-chat-memory-repository-jdbc`。消息按时间戳升序（旧→新）返回。

```java
// 自动装配
@Autowired JdbcChatMemoryRepository repo;
ChatMemory memory = MessageWindowChatMemory.builder()
    .chatMemoryRepository(repo).maxMessages(10).build();

// 手动
ChatMemoryRepository repo2 = JdbcChatMemoryRepository.builder()
    .jdbcTemplate(jdbcTemplate)
    .dialect(new PostgresChatMemoryRepositoryDialect())
    .build();
```

**支持的数据库与方言**：PostgreSQL、MySQL/MariaDB、SQL Server、HSQLDB、Oracle。可用 `JdbcChatMemoryRepositoryDialect.from(DataSource)` 自动探测；扩展新库实现该接口即可。

**配置属性**：

| 属性                                                        | 默认                                          |
| ----------------------------------------------------------- | --------------------------------------------- |
| `spring.ai.chat.memory.repository.jdbc.initialize-schema` | `embedded`（可选 always/never）             |
| `spring.ai.chat.memory.repository.jdbc.schema`            | `classpath:org/.../schema-@@platform@@.sql` |
| `spring.ai.chat.memory.repository.jdbc.platform`          | 自动探测                                      |

启动时自动创建 `SPRING_AI_CHAT_MEMORY` 表（默认仅嵌入式库初始化；Flyway/Liquibase 场景设 `never`）。

**8.4.3 Cassandra**

依赖 `...-repository-cassandra`。时序 schema，保留全部历史窗口，适合治理/审计；建议设 TTL（如三年）。

```java
ChatMemoryRepository repo = CassandraChatMemoryRepository
    .create(CassandraChatMemoryRepositoryConfig.builder().withCqlSession(cqlSession).build());
```

配置：`spring.ai.chat.memory.cassandra.{time-to-live,keyspace(默认springframework),messages-column,table(ai_chat_memory),initialize-schema}`；`spring.cassandra.contactPoints/port/localDatacenter`。

**8.4.4 Neo4j**

依赖 `...-repository-neo4j`。消息按索引升序返回。

```java
ChatMemoryRepository repo = Neo4jChatMemoryRepository.builder().driver(driver).build();
```

标签配置：`spring.ai.chat.memory.repository.neo4j.{sessionLabel=Session,messageLabel=Message,toolCallLabel=ToolCall,metadataLabel=Metadata,toolResponseLabel=ToolResponse,mediaLabel=Media}`。自动建会话 ID/消息索引。

**8.4.5 CosmosDB**

依赖 `...-repository-cosmos-db`。conversationId 作分区键。

```java
ChatMemoryRepository repo = CosmosDBChatMemoryRepository.create(
    CosmosDBChatMemoryRepositoryConfig.builder()
        .withCosmosClient(cosmosAsyncClient)
        .withDatabaseName("chat-memory-db").withContainerName("conversations").build());
```

配置：`...cosmosdb.{endpoint,key,connection-mode(gateway),database-name(SpringAIChatMemory),container-name(ChatMemory),partition-key-path(/conversationId)}`。支持 Key 认证与 Azure Identity（DefaultAzureCredential）。

**8.4.6 Mongo**

依赖 `...-repository-mongodb`。

```java
ChatMemoryRepository repo = MongoChatMemoryRepository.builder().mongoTemplate(mongoTemplate).build();
```

配置：`spring.ai.chat.memory.repository.mongo.{create-indices=false,ttl=0}`。启动自动建 `ai_chat_memory` collection。

### 8.5 用窗口记忆 + 持久化仓库组装

```java
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

### 8.6 会话隔离（关键）

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

### 8.7 记忆在 ChatClient / ChatModel 中（补齐）

**ChatClient 记忆 Advisor**：

- `MessageChatMemoryAdvisor`（推荐）：每次交互取历史并以**消息集合**并入 prompt。
- `PromptChatMemoryAdvisor`（1.1.3 起废弃）：把历史拼进 system prompt（XML 标签 + HTML 实体转义）。
- `VectorStoreChatMemoryAdvisor`：用向量库做记忆，历史拼进 system 消息，检索文档包在 `<memory-entry>` XML 元素中，内容转义以降低注入风险；其默认 system 模板要求模型把 `LONG_TERM_MEMORY` 仅当历史数据而非指令。可 `.promptTemplate()` 自定义（须含 `instructions` 与 `long_term_memory` 两个占位）。

```java
ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
    .build();
```

**ChatModel 手动记忆**：

```java
ChatMemory chatMemory = MessageWindowChatMemory.builder().build();
String conversationId = "007";
UserMessage m1 = new UserMessage("My name is James Bond");
chatMemory.add(conversationId, m1);
ChatResponse r1 = chatModel.call(new Prompt(chatMemory.get(conversationId)));
chatMemory.add(conversationId, r1.getResult().getOutput());
// ... 之后问 "What is my name?" 会答出 "James Bond"
```

### 8.8 过时对照

| 过时                                        | 1.1.x 正确写法                                                        |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `PromptChatMemoryAdvisor`（1.1.3 起废弃） | `MessageChatMemoryAdvisor`                                          |
| 旧版把历史拼进 system prompt                | 以类型化`Message` 列表传入请求                                      |
| 依赖自定义 system 模板                      | 不支持（`systemPromptTemplate()` 抛 UnsupportedOperationException） |

---

## 9. 多模型 / OpenAI 兼容（补齐）—— 本项目已在用

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

- 多模型统一路由是**本项目核心**：`LlmModelRouter` 基于多 `ChatModel` Bean 实现按需选择（见 2.1.2 / 2.1.3 的多种装配方式）。
- 常用 `ChatOptions` 通用属性：`model`、`temperature`、`maxTokens`、`topP`、`frequencyPenalty`、`presencePenalty`、`stopSequences`、`tools`、`toolChoice`、`responseFormat` 等；模型专属选项类（如 `OpenAiChatOptions`）还带 `seed`、`logitBias`、`user` 等。

---

## 10. RAG（检索增强，补齐）—— 项目 Phase 2 规划

### 10.0 前置依赖

- `QuestionAnswerAdvisor` / `VectorStoreChatMemoryAdvisor` 需 `spring-ai-advisors-vector-store`。
- 模块化 RAG 需 `spring-ai-rag`。

### 10.1 朴素 RAG：QuestionAnswerAdvisor（补齐）

```java
@Autowired VectorStore vectorStore;

ChatClient chatClient = ChatClient.builder(chatModel)
    .defaultAdvisors(QuestionAnswerAdvisor.builder(vectorStore).build())
    .build();

String answer = chatClient.prompt()
    .user("根据我的知识库回答：...")
    .call()
    .content();
```

**检索参数**：

```java
var qaAdvisor = QuestionAnswerAdvisor.builder(vectorStore)
    .searchRequest(SearchRequest.builder().similarityThreshold(0.8d).topK(6).build())
    .build();
```

**动态过滤表达式**（运行时改 `FILTER_EXPRESSION` 上下文参数）：

```java
ChatClient.builder(chatModel)
    .defaultAdvisors(QuestionAnswerAdvisor.builder(vectorStore)
        .searchRequest(SearchRequest.builder().build()).build())
    .build()
    .prompt()
    .user("Please answer my question XYZ")
    .advisors(a -> a.param(QuestionAnswerAdvisor.FILTER_EXPRESSION, "type == 'Spring'"))
    .call().content();
```

**自定义模板**（`.promptTemplate()`，须含 `query` 与 `question_answer_context` 两个占位）：

```java
PromptTemplate custom = PromptTemplate.builder()
    .renderer(StTemplateRenderer.builder().startDelimiterToken('<').endDelimiterToken('>').build())
    .template("""
        <query>
        Context information is below.
        ---------------------
        <question_answer_context>
        ---------------------
        Given the context and no prior knowledge, answer the query.
        """)
    .build();
QuestionAnswerAdvisor qa = QuestionAnswerAdvisor.builder(vectorStore)
    .promptTemplate(custom).build();
```

> `.userTextAdvise()` 已废弃，改 `.promptTemplate()`。

### 10.2 模块化 RAG：RetrievalAugmentationAdvisor（补齐）

基于 `org.springframework.ai.rag` 包的 Modular RAG 架构，提供开箱即用的常用流程组装。

**Naive RAG**：

```java
Advisor advisor = RetrievalAugmentationAdvisor.builder()
    .documentRetriever(VectorStoreDocumentRetriever.builder()
        .similarityThreshold(0.50)
        .vectorStore(vectorStore)
        .build())
    .build();
String answer = chatClient.prompt().advisors(advisor).user(question).call().content();
```

默认不允许检索上下文为空（此时会指示模型不回答）；可放行空上下文：

```java
.queryAugmenter(ContextualQueryAugmenter.builder().allowEmptyContext(true).build())
```

**Advanced RAG（带查询改写 + 动态过滤）**：

```java
Advisor advisor = RetrievalAugmentationAdvisor.builder()
    .queryTransformers(RewriteQueryTransformer.builder()
        .chatClientBuilder(chatClientBuilder.build().mutate()).build())
    .documentRetriever(VectorStoreDocumentRetriever.builder()
        .similarityThreshold(0.50).vectorStore(vectorStore).build())
    .build();

// 动态过滤
chatClient.prompt()
    .advisors(advisor)
    .advisors(a -> a.param(VectorStoreDocumentRetriever.FILTER_EXPRESSION, "type == 'Spring'"))
    .user(question).call().content();
```

### 10.3 RAG 模块分层（补齐）

**Pre-Retrieval（检索前，处理查询以提升检索质量）**

- Query Transformation（查询改写）：
  - `CompressionQueryTransformer`：把对话历史+追问压缩成独立查询。
  - `RewriteQueryTransformer`：改写冗余/歧义查询。
  - `TranslationQueryTransformer`：把查询翻译成 embedding 模型支持的语言（`targetLanguage("english")`）。
  - > 用 QueryTransformer 时建议 ChatClient.Builder 用低 temperature（如 0.0）保证确定性。
    >
- Query Expansion（查询扩展）：
  - `MultiQueryExpander`：扩展成多个语义多样查询（`numberOfQueries(3)`、`includeOriginal(false)`）。

**Retrieval（检索）**

- Document Search：
  - `VectorStoreDocumentRetriever`：向量相似检索，支持 `similarityThreshold`、`topK`、`filterExpression`（静态或 `Supplier` 动态，或经 Query 的 `FILTER_EXPRESSION` 参数按请求指定，后者优先）。
- Document Join（文档汇合）：
  - `ConcatenationDocumentJoiner`：把多查询/多源文档拼接，去重保留首现，得分原样保留。

**Post-Retrieval（检索后）**

- Document Post-Processing：可基于查询对文档排序/去冗余/压缩，缓解 lost-in-the-middle 与上下文超限。可用 `DocumentPostProcessor` 接口实现（重排、去重、压缩）。

**Generation（生成）**

- Query Augmentation：
  - `ContextualQueryAugmenter`：用文档内容增强用户查询（默认不允许空上下文；`allowEmptyContext(true)` 放行）。模板可用 `.promptTemplate()` 与 `.emptyContextPromptTemplate()` 定制。

### 10.4 底层 RAG 组件用法示例（补齐）

```java
// 查询改写（压缩）
Query q = Query.builder()
    .text("And what is its second largest city?")
    .history(new UserMessage("What is the capital of Denmark?"),
             new AssistantMessage("Copenhagen is the capital of Denmark."))
    .build();
QueryTransformer t = CompressionQueryTransformer.builder()
    .chatClientBuilder(chatClientBuilder).build();
Query transformed = t.transform(q);

// 文档检索（动态过滤）
DocumentRetriever r = VectorStoreDocumentRetriever.builder()
    .vectorStore(vectorStore)
    .filterExpression(() -> new FilterExpressionBuilder()
        .eq("tenant", TenantContextHolder.getTenantIdentifier()).build())
    .build();
List<Document> docs = r.retrieve(new Query("What are the KPIs for next semester?"));
```

---

## 11. Vector Store（向量库，补齐）—— 项目 Phase 2 规划

### 11.1 核心接口

```java
// 只读检索接口
@FunctionalInterface public interface VectorStoreRetriever {
    List<Document> similaritySearch(SearchRequest request);
    default List<Document> similaritySearch(String query) { ... }
}

// 读写接口
public interface VectorStore extends DocumentWriter, VectorStoreRetriever {
    default String getName() { ... }
    void add(List<Document> documents);
    void delete(List<String> idList);
    void delete(Filter.Expression filterExpression);
    default void delete(String filterExpression) { ... }
    default <T> Optional<T> getNativeClient() { ... }
}
```

- `Document` 封装数据源内容（文本 + 元数据 Map）。
- 向量由 `EmbeddingModel` 生成（如 OpenAI `text-embedding-ada-002`），向量库本身不生成 embedding。

### 11.2 SearchRequest

```java
SearchRequest request = SearchRequest.builder()
    .query(question)
    .topK(5)                  // 返回前 5 条
    .similarityThreshold(0.7) // 相似度阈值 [0,1]，越高越相似
    .filterExpression("country == 'UK' && year >= 2020 && isActive == true")
    .build();
List<Document> docs = retriever.similaritySearch(request);
```

- 常量：`SIMILARITY_THRESHOLD_ACCEPT_ALL = 0.0`、`DEFAULT_TOP_K = 4`。
- `.similarityThresholdAll()` 等价于阈值 0.0。
- `filterExpression` 支持 String（ANTLR4 外部 DSL）或 `Filter.Expression`（Builder DSL）。

### 11.3 元数据过滤（补齐）

**Filter 字符串示例**：`country == 'BG'`、`genre == 'drama' && year >= 2020`、`genre in ['comedy','documentary','drama']`。

**FilterExpressionBuilder（DSL）**：

```java
FilterExpressionBuilder b = new FilterExpressionBuilder();
// 单条件
Expression e1 = b.eq("country", "BG").build();
// 组合
Expression e2 = b.and(b.eq("genre","drama"), b.gte("year",2020)).build();
Expression e3 = b.and(b.in("genre","drama","documentary"), b.not(b.lt("year",2020))).build();
Expression e4 = b.isNull("year").build();  // IS NULL / IS NOT NULL（部分向量库未实现）
```

运算符：`==`、`>`、`>=`、`<`、`<=`、`!=`、`+`、`-`；组合 `AND/and/&&`、`OR/or/||`；集合 `IN/NIN`、`NOT`、`IS NULL / IS NOT NULL`。

### 11.4 删除文档（补齐）

```java
vectorStore.delete(List.of(document.getId()));      // 按 ID（不存在的 ID 忽略）
vectorStore.delete(new Filter.Expression(...));      // 按 Filter.Expression
vectorStore.delete("country == 'Bulgaria'");         // 按字符串过滤
```

- 版本管理用例：新版本文档先按 `docId+version` 过滤删旧、再 add 新。
- 建议：批量删除要分批；删除操作包 try-catch；按 ID 删通常更快，按属性删用过滤表达式。

### 11.5 写入 / 读取分离（补齐）

```java
// 写入服务只依赖 VectorStore
@Service class DocumentIndexer {
    private final VectorStore vectorStore;
    public void index(List<Document> docs) { vectorStore.add(docs); }
}
// 只读服务只依赖 VectorStoreRetriever（最小权限）
@Service class DocumentRetriever {
    private final VectorStoreRetriever retriever;
    public List<Document> findSimilar(String q) { return retriever.similaritySearch(q); }
}
```

### 11.6 Batching 策略（补齐）

`BatchingStrategy` 把大批文档按 token 分批嵌入，避免超出模型上下文窗口：

```java
public interface BatchingStrategy { List<List<Document>> batch(List<Document> documents); }
```

- 默认 `TokenCountBatchingStrategy`：上限取 OpenAI 8191 token，保留 10% 余量，`actualMax = max * (1 - reserve)`；单文档超限抛异常。
- 自定义：

```java
@Bean BatchingStrategy customBatching() {
    return new TokenCountBatchingStrategy(EncodingType.CL100K_BASE, 8000, 0.1);
}
```

- 内部用 `TokenCountEstimator`（默认 `JTokkitTokenCountEstimator`）估算 token；可注入自定义 estimator。
- **Auto-truncation 配合**：若 embedding 模型开启 auto_truncate，batching 上限要设得远比模型实际上限大（如 Vertex 实际 20k、batching 设 132900），避免 batching 提前抛异常、由模型静默截断。注意截断可能丢失长文末尾信息，需要全量嵌入时请先切分。

### 11.7 向量库实现清单（补齐）

Azure Vector Search、Apache Cassandra、Chroma、Elasticsearch、GemFire、MariaDB、Milvus、MongoDB Atlas、Neo4j、OpenSearch、Oracle Database、PgVector（PostgreSQL）、Pinecone、Qdrant、Redis、SAP HANA、Typesense、Weaviate，以及**仅测试用**的 `SimpleVectorStore`。

> `SimpleVectorStore` 不用于生产，只适合测试/演示。

### 11.8 示例：JsonReader 灌库 + 检索（补齐）

```java
@Autowired VectorStore vectorStore;
void load(String sourceFile) {
    JsonReader reader = new JsonReader(new FileSystemResource(sourceFile),
        "price","name","shortDescription","description","tags");
    vectorStore.add(reader.get());
}
// 检索
List<Document> similar = vectorStore.similaritySearch(
    SearchRequest.builder().query(question).topK(5).similarityThreshold(0.7).build());
```

---

## 12. ETL 管线（补齐）—— 项目 Phase 2 规划

ETL 框架是 RAG 数据处理的骨架：从原始数据源 → 结构化 Vector Store。

三大接口（都可链式组合）：

```java
public interface DocumentReader extends Supplier<List<Document>> {
    default List<Document> read() { return get(); }
}
public interface DocumentTransformer extends Function<List<Document>, List<Document>> {
    default List<Document> transform(List<Document> d) { return apply(d); }
}
public interface DocumentWriter extends Consumer<List<Document>> {
    default void write(List<Document> d) { accept(d); }
}
```

典型组装：

```java
vectorStore.accept(tokenTextSplitter.apply(pagePdfReader.get()));
// 等价语义化写法
vectorStore.write(tokenTextSplitter.split(pagePdfReader.read()));
```

### 12.1 DocumentReaders（读取器，补齐）

> 多数 Reader/Writer 用 `Resource` 构造并内部走 `DefaultResourceLoader`，注意不要直接用用户提供的 URL 构造（有安全隐患）。

**JSON `JsonReader`**：

- 构造：`JsonReader(Resource)` / `JsonReader(Resource, String...jsonKeysToUse)` / `JsonReader(Resource, JsonMetadataGenerator, String...jsonKeysToUse)`。
- 支持 JSON 数组与单对象；按 `jsonKeysToUse` 取值做 content（多 key 拼接）；未指定则整对象为 content。
- JSON Pointer（RFC 6901）取子集：`jsonReader.get("/store/books/0")`；指针无效抛 `IllegalArgumentException`。
- 用 Jackson，数组流式解析可处理大文件。

**Text `TextReader`**：

- `TextReader(String resourceUrl)` / `TextReader(Resource)`。
- `setCharset(...)`（默认 UTF-8）、`getCustomMetadata()`（可变 Map 加自定义元数据）。
- 自动元数据：`charset`、`source`（文件名）。整个文件读成一个 Document，超大文件慎用。

**HTML `JsoupDocumentReader`**（依赖 `spring-ai-jsoup-document-reader`）：

- `JsoupDocumentReaderConfig`：`charset`(UTF-8)、`selector`(body)、`separator`(\n)、`allElements`、`groupByElement`、`includeLinkUrls`、`metadataTags`([description,keywords])、`additionalMetadata`。
- 支持按 selector 提取、按元素分组、抽取 link 与 meta。

**Markdown `MarkdownDocumentReader`**（依赖 `spring-ai-markdown-document-reader`）：

- `MarkdownDocumentReaderConfig`：`horizontalRuleCreateDocument`（水平线分段）、`includeCodeBlock`、`includeBlockquote`、`additionalMetadata`。
- 标题进 metadata，段落为 content，代码块/引用可独立成 Document。

**PDF 页 `PagePdfDocumentReader`**（依赖 `spring-ai-pdf-document-reader`，Apache PdfBox）：

```java
PagePdfDocumentReader reader = new PagePdfDocumentReader("classpath:/sample1.pdf",
    PdfDocumentReaderConfig.builder()
        .withPageTopMargin(0)
        .withPageExtractedTextFormatter(ExtractedTextFormatter.builder().build())
        .withPagesPerDocument(1)
        .build());
```

**PDF 段落 `ParagraphPdfDocumentReader`**：用 PDF 目录（TOC）把 PDF 拆成段落、每段落一个 Document；注意并非所有 PDF 都含目录。

**Tika `TikaDocumentReader`**（依赖 `spring-ai-tika-document-reader`）：支持 PDF、DOC/DOCX、PPT/PPTX、HTML 等大量格式。

```java
TikaDocumentReader reader = new TikaDocumentReader(this.resource);
List<Document> docs = reader.read();
```

### 12.2 DocumentTransformers（转换器，补齐）

**`TextSplitter`**（抽象基类）与 **`TokenTextSplitter`**（CL100K_BASE 按 token 切分）：

```java
// 默认
TokenTextSplitter splitter = new TokenTextSplitter();
// 全参构造
new TokenTextSplitter(1000, 400, 10, 5000, true, List.of('.', '?', '!', '\n'));
// 推荐 Builder
TokenTextSplitter sp = TokenTextSplitter.builder()
    .withChunkSize(1000).withMinChunkSizeChars(400)
    .withMinChunkLengthToEmbed(10).withMaxNumChunks(5000)
    .withKeepSeparator(true)
    .build();
```

参数：`chunkSize`(默认800)、`minChunkSizeChars`(350)、`minChunkLengthToEmbed`(5)、`maxNumChunks`(10000)、`keepSeparator`(true)、`punctuationMarks`([.,?,!,\n])。

> **多语言/中文**：用 `withPunctuationMarks(List.of('。','？','！','；'))` 定制断句。标点列表建议 <20 个以保证性能。仅当 token 数超过 chunkSize 时才按标点切分，小文本不碎化。

**`ContentFormatTransformer`**：统一文档内容格式。

**`KeywordMetadataEnricher`**：用 ChatModel 抽取关键词进 `excerpt_keywords` 元数据：

```java
KeywordMetadataEnricher enricher = KeywordMetadataEnricher.builder(chatModel)
    .keywordCount(5)   // 若同时设 keywordsTemplate 则 keywordCount 被忽略
    .build();
```

**`SummaryMetadataEnricher`**：用 ChatModel 生成摘要进元数据：

```java
SummaryMetadataEnricher enricher = new SummaryMetadataEnricher(chatModel,
    List.of(SummaryType.PREVIOUS, SummaryType.CURRENT, SummaryType.NEXT));
```

- 元数据键：`section_summary`（当前）、`prev_section_summary`（前一个）、`next_section_summary`（后一个）。
- 首篇无 prev、末篇无 next；第 i 篇的 section_summary 等于第 i-1 篇的 next_section_summary。
- 模板可自定义；`MetadataMode` 控制摘要生成时元数据的纳入方式。

### 12.3 DocumentWriters（写入器，补齐）

**`FileDocumentWriter`**：

```java
new FileDocumentWriter("output.txt", true, MetadataMode.ALL, true).accept(documents);
```

- 构造：`(fileName)` / `(fileName, withDocumentMarkers)` / `(fileName, withDocumentMarkers, metadataMode, append)`。
- `withDocumentMarkers=true` 时写 `### Doc: [index], pages:[start,end]` 标记（用 `page_number`/`end_page_number` 元数据）。`metadataMode` 控制写入内容（默认 NONE）。`append` 决定追加/覆盖。
- 用 FileWriter，编码为 OS 默认；写错抛 RuntimeException。适合调试/人读输出。

**`VectorStore`（作为 Writer）**：`vectorStore.write(documents)`，见第 11 章。

---

## 13. 多模态（补齐）

`UserMessage` 支持带多模态 Media（图片/音频/视频）。见 3.2。ChatClient 链式：

```java
chatClient.prompt()
    .user(u -> u.text("描述这张图片")
        .media(MimeTypeUtils.parseMimeType("image/png"), imageUrl))
    .call().content();
```

- `media(MimeType, Object data)` / `media(MimeType, URI uri)` 多个重载。
- 是否可用取决于底层模型（GPT-4o、Gemini、Qwen-VL 等）。
- 多模态输出转换可借助 `AbstractMessageOutputConverter` / `MessageConverter`。

---

## 14. 视频过时写法 → 1.1.x 速查对照表（扩充）

| 视频里的旧写法                                         | 1.1.x 新写法                                                      | 变化本质            |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------------------- |
| `ChatModel` 直接 `call(Prompt)`                    | `ChatClient.builder(model).prompt().user().call().content()`    | 门面化、链式        |
| `FunctionCallback.builder()`                         | `@Tool` 注解 或 `MethodToolCallback`/`FunctionToolCallback` | 重构为 ToolCallback |
| `FunctionMessage`                                    | `ToolCallMessage` / `ToolResponseMessage`                     | 消息类型重构        |
| `PromptChatMemoryAdvisor`                            | `MessageChatMemoryAdvisor`                                      | 记忆类型化          |
| 记忆无会话隔离                                         | `advisors(a -> a.param(ChatMemory.CONVERSATION_ID, id))`        | 会话隔离必填        |
| `entity()` 泛型写法不规范                            | `entity(ParameterizedTypeReference<T>)`                         | 支持泛型            |
| 结构化输出靠手写 JSON 提示                             | `entity(Class)` / `StructuredOutputConverter` / Native SO     | 统一转换器          |
| 手动拼 RAG 上下文                                      | `QuestionAnswerAdvisor` / `RetrievalAugmentationAdvisor`      | Advisor 化、模块化  |
| 手动批量嵌入大数据                                     | `BatchingStrategy`（TokenCountBatchingStrategy）                | 自动分批            |
| `spring-ai-model` / `spring-ai-client-chat` 单独引 | 直接用各类`starter`                                             | 模块合并            |
| `RequestAdvisor/ResponseAdvisor`（1.0 M2）           | `CallAdvisor`/`StreamAdvisor`（1.0.0 起）                     | 接口演进            |
| `AdvisedRequest/AdvisedResponse`                     | `ChatClientRequest`/`ChatClientResponse`                      | 命名统一            |

---

## 15. 常见配置属性速查（补齐）

| 前缀                                                         | 示例                       | 说明                                         |
| ------------------------------------------------------------ | -------------------------- | -------------------------------------------- |
| `spring.ai.chat.client.enabled`                            | `false`                  | 关闭 ChatClient.Builder 自动装配（多模型时） |
| `spring.ai.openai.chat.options.model`                      | `gpt-4o`                 | OpenAI 默认模型                              |
| `spring.ai.openai.chat.options.temperature`                | `0.5`                    | 采样温度                                     |
| `spring.ai.openai.chat.options.responseFormat`             | `{"type":"json_object"}` | JSON 模式                                    |
| `spring.ai.chat.memory.repository.jdbc.*`                  | 见 8.4.2                   | JDBC 记忆仓库                                |
| `spring.ai.chat.memory.repository.mongo.*`                 | 见 8.4.6                   | Mongo 记忆仓库                               |
| `logging.level.org.springframework.ai.chat.client.advisor` | `DEBUG`                  | SimpleLoggerAdvisor 日志                     |

---

## 16. 官方文档入口速查（1.1.x，扩充）

| 主题                                | 地址（前缀`https://docs.spring.io/spring-ai/reference/1.1/`） |
| ----------------------------------- | --------------------------------------------------------------- |
| Chat Client API                     | `api/chatclient.html`                                         |
| Chat Memory                         | `api/chat-memory.html`                                        |
| Tool Calling                        | `api/tools.html`                                              |
| FunctionCallback→ToolCallback 迁移 | `api/tools-migration.html`                                    |
| Structured Output                   | `api/structured-output-converter.html`                        |
| Advisors                            | `api/advisors.html`                                           |
| RAG                                 | `api/retrieval-augmented-generation.html`                     |
| Vector Databases                    | `api/vectordbs.html`                                          |
| ETL Pipeline                        | `api/etl-pipeline.html`                                       |
| 多模态                              | `api/multimodality.html`                                      |
| 1.1 升级说明                        | `upgrade-notes.html`                                          |

> 提示：1.1.x 线内（1.1.0→1.1.8）API 稳定，按需把 `reference/1.1` 换成 `reference/1.1.8` 可固定版本阅读。
