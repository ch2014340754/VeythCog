# VeythCog-C · Backend of Personal Full-Stack Workbench

> Backend of **VeythCog (渡思)** Personal AI Workbench.
> Built with Spring Boot 3 + Java 21 + Spring AI to practice **LLM application engineering**: multi-model scheduling, RAG retrieval, and SSE streaming.

## Monorepo

```
D:\demo\
├── VeythCog-V   Frontend (React 18 + TS + Vite + AntD)
└── VeythCog-C   Backend  (this repo, Spring Boot 3 + Java 21 + Spring AI)
```

## Stack

- Spring Boot 3.5.8 / Java 21
- Spring AI Alibaba (DashScope, OpenAI-compatible)
- knife4j / OpenAPI 3 · Hutool · Lombok
- PostgreSQL + pgvector (planned, for RAG)

## Modules (modular monolith)

```
vc-common   common lib: unified response, exception framework, utils (pure POJO, no web/AI)
vc-llm      LLM gateway domain: multi-vendor abstraction, routing, model management (lib)
vc-chat     conversation domain: sessions/messages/memory (lib, depends on vc-llm)
vc-knowledge knowledge-base domain: ingest/chunk/embed/retrieve (lib)
vc-app      THE only runnable app (port 8123, context-path /api): auth / web / admin / RAG orchestration
vc-learn    Spring AI learning sandbox (independent, DashScope only)
```

Dependency direction (one-way): `vc-common ← vc-llm ← (vc-chat, vc-knowledge) ← vc-app`.
Only `vc-app` is runnable; the rest are plain libraries (no boot plugin, no main class).

## Quick Start

```bash
export DASHSCOPE_API_KEY=sk-xxx
mvn install -DskipTests            # install internal domain modules first
cd vc-app && mvn spring-boot:run   # or run com.vc.app.VcAppApplication in IDEA
```

- Service: `http://localhost:8123`
- API docs: `http://localhost:8123/api/swagger-ui.html`

## Roadmap

| Phase | Scope | Deep zone |
|---|---|---|
| 0 | Contract + skeleton: JWT auth, OpenAPI, Docker(pgvector), frontend login | — |
| 1 | Multi-model chat: provider abstraction, routing, fallback, SSE, persistence | ★ llm-gateway |
| 2 | RAG knowledge base: ingest → chunk → embed → pgvector → citation answer | ★ RAG pipeline |
| 3 | Polish & deploy: Docker full stack, seed data, docs, core tests, demo script | metrics |

See [`docs/architecture.md`](docs/architecture.md) (Chinese) for details.

## Security

- API keys are read from environment variables; `application-local.yml` is gitignored.
- Rotate any leaked key in the DashScope console.
