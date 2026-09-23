# VeythCog · 渡思 —— 个人全栈工作台

> 一处聚合个人开发工具、代码片段、笔记与 AI 能力的自用门户；同时以 Java 后端 × LLM 工程化为面试作品集。

## Monorepo 结构

```
D:\demo\
├── VeythCog-V    前端（React 18 + TS + Vite + AntD 5 + Zustand）
├── VeythCog-C    后端（Spring Boot 3 + Java 21 + Spring AI）
└── README.md     本文件
```

| 项目 | 技术栈 | 快速入口 |
|---|---|---|
| [VeythCog-V](VeythCog-V/) | React 18 / TS / Vite / AntD 5 / Zustand | `npm run dev` → :3000 |
| [VeythCog-C](VeythCog-C/) | Spring Boot 3.5 / Java 21 / Spring AI | `mvn spring-boot:run` → :8123 |

## 核心能力（面试深水区）

- **多模型对话**：供应商抽象 + 模型路由 + 降级重试 + SSE 流式（`VeythCog-C/llm-gateway`）
- **RAG 知识库**：上传→分块→Embedding→pgvector 检索→带引用回答（`VeythCog-C/knowledge`）
- **开发者工具集**：24+ 常用工具（前端，已完成）

## 开发约定

- 前后端解耦、契约先行：前端先走 mock，后端按 OpenAPI 契约实现后切换。
- 单库两用：PostgreSQL + pgvector 同时承载业务数据与向量检索。
- 每阶段可演示，防烂尾。

## 快速启动（后端依赖 DashScope API Key）

```bash
# 后端
cd VeythCog-C
export DASHSCOPE_API_KEY=sk-xxx
mvn -pl vc-chat -am spring-boot:run

# 前端
cd VeythCog-V
npm install && npm run dev
```

> 详细设计见 `VeythCog-C/docs/architecture.md`。
