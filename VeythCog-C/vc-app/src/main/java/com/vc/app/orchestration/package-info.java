/**
 * 应用编排层 —— 跨域的"组合动作"在这里完成，保持域模块相互不依赖。
 *
 * <p>核心场景：RAG 增强对话（Phase 2）。编排顺序：</p>
 * <pre>
 *   问题 → vc-knowledge 检索(retriever) → 拼上下文 + 引用 → vc-chat 作答 → 带引用返回
 * </pre>
 *
 * <p>chat 域与 knowledge 域在此被装配，而不在任一域内互相 import，保证依赖方向单向。</p>
 */
package com.vc.app.orchestration;
