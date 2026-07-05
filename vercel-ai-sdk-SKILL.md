---
name: vercel-ai-sdk
description: >-
  Use this skill whenever writing, reviewing, or debugging TypeScript or JavaScript code that
  uses the Vercel AI SDK (package "ai", "@ai-sdk/*") - including generateText, streamText,
  generateObject, streamObject, tool calling, agents, useChat, WorkflowAgent, MCP integration,
  AI Gateway, or reasoning, voice, and video features. Trigger this skill any time the user
  mentions AI SDK, Vercel AI, building a chatbot or agent in Next.js, React, Vue, or Svelte with
  an LLM, streaming LLM responses to a frontend, tool or function calling with an LLM in
  TypeScript, or migrating between AI SDK v6 and v7, even if they do not say "Vercel AI SDK"
  explicitly. Covers the full surface up to AI SDK 7 (June 2026), including the Core Generation
  API, Agentic and Tool Calling, AI SDK UI, Telemetry, and the Infrastructure and Provider layer
  (AI Gateway, MCP Apps).
---

# Vercel AI SDK — Full Surface Reference (up to AI SDK 7)

A reference skill for building correct, current, non-outdated code with the Vercel AI SDK. The SDK moves fast (weekly patch releases, major version jumps every few months), so treat this file as ground truth over training-data memory, and still verify against `https://ai-sdk.dev/docs` or the installed package version when something is safety- or version-critical.

## Before writing any code

1. Check the installed version: `cat package.json | grep '"ai"'` or `npm ls ai`. Behavior differs meaningfully between v4/v5 (legacy), v6 (agents, approvals), and v7 (runtime context, reasoning, MCP Apps, voice/video).
2. If the user's code imports patterns not in this file (unfamiliar hook, option, or provider), don't guess — say so and suggest checking `ai-sdk.dev/docs` or running `npx @ai-sdk/codemod v7` if migrating.
3. Default to the **latest stable APIs** below unless the user's `package.json` pins an older major version — in that case, downgrade guidance accordingly (e.g. no `needsApproval` before v6, no `reasoning` option before v7).

---

## Decision Matrix — pick the right primitive first

| User wants to build... | Use |
| :--- | :--- |
| Standard chatbot / summarizer / translator | `streamText` (or `generateText` for non-streaming) |
| Structured data extraction (invoices, sentiment, classification) | `generateObject` / `streamObject` + Zod schema |
| AI that calls real functions (DB lookup, weather, email) | `tools` |
| Multi-step autonomous reasoning (search → analyze → summarize) | `maxSteps` / agent loop |
| Long-running background agent (research, report generation) | `WorkflowAgent` (durable execution) |
| Chat UI in React/Vue/Svelte | `useChat` / `useCompletion` |
| AI returning live UI components, not just text | Generative UI / message-parts |
| Sensitive tool actions needing human sign-off | `needsApproval` (Tool Execution Approval) |
| Tool needing an API key/config not from the model | Tool Context / Tool Runtime Context |
| Repeated calls with a large file (PDF, dataset) | `uploadFile` API |
| Voice assistant or video generation | Real-time voice / video generation (v7) |
| Routing across multiple model providers with one bill | AI Gateway |
| Connecting to third-party apps (Gmail, Slack, Asana) | MCP Apps integration (v7) |
| Debugging an agent live | Terminal UI (TUI) / DevTools |

---

## Pillar 1: Core Generation API

### `generateText` / `streamText`
Send a prompt, get plain text back — instant (`generateText`) or token-by-token (`streamText`).
```ts
import { streamText } from 'ai';
const result = streamText({
  model: 'openai/gpt-5.2',
  prompt: 'Explain quantum entanglement.',
});
```
Use for: chatbots, article generators, translators, summarizers.

### `generateObject` / `streamObject`
Force JSON output matching a Zod schema.
```ts
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: 'openai/gpt-5.2',
  schema: z.object({ sentiment: z.enum(['positive','negative','neutral']), score: z.number() }),
  prompt: 'Classify: "I love this product!"',
});
```
Use for: receipt/invoice extraction, auto-generated quizzes, sentiment analysis for a database.

### `reasoning` option (v7+)
Uniform reasoning-effort control across providers.
```ts
streamText({ model: 'anthropic/claude-sonnet-5', reasoning: 'high', prompt: '...' });
```
Falls back to `providerOptions` for provider-specific reasoning knobs not covered by the unified option. Use for multi-step analysis, debugging, or any task benefiting from deeper deliberation — skip it for simple lookups to save latency/cost.

### `uploadFile` API (v7+)
Upload once, reference many times — avoids resending the same bytes on every call.
```ts
const file = await uploadFile({ path: './report.pdf' });
streamText({ model: '...', messages: [{ role: 'user', content: [{ type: 'file', file } , { type: 'text', text: 'Summarize page 3.' }] }] });
```
Use for agents that repeatedly reference the same large PDF/image/dataset across steps.

### Per-tool strict mode (v6+)
Strict mode (guarantees tool input matches schema exactly) is opt-in **per tool**, not global — so one incompatible schema won't fail the whole request.
```ts
tool({ /* ... */, strict: true })
```

### Tool input examples (v6+)
Add concrete example inputs to a tool's schema when field descriptions alone aren't enough to steer the model toward the exact pattern needed (e.g. phone number formats, product codes).

---

## Pillar 2: Agentic & Tool Calling

### `tools` (function calling)
```ts
import { tool } from 'ai';
import { z } from 'zod';

const checkStock = tool({
  description: 'Check shoe stock by size',
  parameters: z.object({ size: z.number() }),
  execute: async ({ size }) => db.stock.find({ size }),
});
```

### `maxSteps` (multi-step agent loop)
Lets the model chain tool calls autonomously within one request (think → call tool A → think → call tool B → done) without a new user prompt between steps.

### `needsApproval` — Tool Execution Approval (v6+)
Human-in-the-loop gate before a sensitive tool runs.
```ts
tool({
  needsApproval: async ({ input }) => input.command.includes('rm -rf'),
  execute: async (input) => { /* ... */ },
})
```
In the UI, check the tool-invocation state via `useChat` and respond with `addToolApprovalResponse`. Use for destructive DB writes, sending emails, running shell commands — auto-approve safe ones (`ls`), gate risky ones.

### Tool Context / Tool Runtime Context (v7+)
Typed data passed to a single tool (API keys, config) without exposing it to other tools, plus a typed runtime context readable/writable in `prepareStep` and approval functions — useful for sharing internal logic across a `ToolLoopAgent`.

### Built-in provider tools (v6+)
- **Memory Tool** — persist/retrieve info across conversations via a memory file directory.
- **Tool Search (Regex / BM25)** — dynamically select from a large tool set instead of sending all tool definitions every call.
- **Code Execution Tool** — run code in a sandboxed environment with bash/file ops.
- **Programmatic Tool Calling** — model calls your tools from within a code-execution environment, keeping intermediate results out of the context window.

### `WorkflowAgent` (durable execution)
Keeps an agent alive across long processes, restarts, or dropped connections. In v7 it natively supports tool approvals, timeouts, and sandboxing (previously bolt-on).
```ts
import { WorkflowAgent } from '@ai-sdk/workflow';
```
Use for background research agents, multi-article report generation, anything exceeding typical serverless timeouts.

### Sandbox packages (v7+)
`@ai-sdk/sandbox-vercel`, `@ai-sdk/sandbox-just-bash` — isolate tool execution; configure via `experimental_sandbox` on the constructor or per step.

### Harness integration (v7+)
AI SDK 7 can be paired with external agent harnesses — Codex, Claude Code, Deep Agents, OpenCode, Pi — rather than locking you into one closed framework.

---

## Pillar 3: AI SDK UI

### `useChat` / `useCompletion`
Ready-made hooks for chat state (history, loading, stop button, input, auto-scroll) in React/Vue/Svelte. Don't hand-roll conversation-array state management — use these.

### Generative UI & message-parts
Model returns live UI components (cards, interactive charts, buttons) inline in the conversation instead of raw text — e.g. a stock query renders a bar chart component, not a wall of numbers.

### Terminal UI / TUI (v7+)
Live agent debugging from the terminal — see steps/tool calls in real time without a browser.

### DevTools (v6+)
Visual inspection of request/response payloads and tool-call cycles during development.

### Real-time voice & video generation (v7+)
Provider-agnostic real-time voice plus video generation — the SDK is now multimodal across text, audio/real-time, image, and video, not just text.

---

## Pillar 4: Telemetry & Observability

### OpenTelemetry tracing (built-in)
Auto-logs prompts, latency, and token usage. Essential once in production — answers "why did the bill spike" or "which model call is slow."

### Node.js tracing channel & lifecycle events (v7+)
Deeper visibility into agent lifecycle (step start, tool invoked, step end) plus performance stats — needed for audit trails in regulated industries and debugging complex multi-step agents.

---

## Pillar 5: Infrastructure & Provider Layer

### AI Gateway
Unified routing across providers (OpenAI, Anthropic, xAI, Fireworks, etc.) with consolidated billing and usage observability — use instead of hand-building per-provider routing/failover logic.

### Reranking & image editing (v6+)
Retrieval reranking and model-based image editing, beyond plain text/object generation — useful for RAG pipelines and automated photo edits.

### MCP Apps integration (v7+)
Native support for Model Context Protocol Apps — lets an agent call structured third-party apps (Gmail, Slack, Asana, etc.) without bespoke per-service API integration.

### `eve` (related framework, not part of the SDK itself)
Vercel's open-source agent framework built on the same layer as AI SDK — agents are defined as files under an `agent/` directory and compiled into a production app with durable execution, sandboxing, approvals, subagents, and evals built in. Mention this when the user wants a file-based "Next.js for agents" convention rather than assembling primitives manually.

---

## Migration notes (v6 → v7)

- Run `npx @ai-sdk/codemod v7` for automated migration, or `npx skills add vercel/ai --skill migrate-ai-sdk-v6-to-v7` for the migration skill itself.
- Breaking/additive changes to watch for: `reasoning` option, `uploadFile`, typed tool/runtime context, MCP Apps, TUI — these don't exist pre-v7.
- `needsApproval`, per-tool strict mode, Memory/Tool-Search/Code-Execution tools, DevTools, reranking, image editing — these are v6 additions; don't assume they exist in v4/v5 code.

## Common pitfalls to check for

- Using `needsApproval` or `reasoning` against a `package.json` pinned to AI SDK <6 or <7 respectively — will fail silently or type-error.
- Sending the same large file inline on every step of a multi-step agent instead of `uploadFile` — wastes bandwidth and latency.
- Enabling strict mode globally when only some tools have compatible schemas — will fail the entire request; use per-tool strict mode instead.
- Building custom chat state management in React instead of `useChat` — usually unnecessary and error-prone.
- Forgetting to gate destructive tool calls behind `needsApproval` in production agents.

## When you're not sure

If a requested API, hook, or option isn't in this file, say so plainly and suggest the user (or you, via `web_fetch`) check `https://ai-sdk.dev/docs` — don't invent method signatures. The SDK ships patch releases frequently, so treat anything version-specific as worth double-checking rather than assumed from memory.
