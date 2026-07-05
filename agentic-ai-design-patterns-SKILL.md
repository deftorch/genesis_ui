---
name: agentic-ai-design-patterns
description: >-
  Use this skill whenever designing, reviewing, or reasoning about the architecture of an
  agentic AI system - not just writing SDK code, but deciding how the agent should think, plan,
  remember, coordinate with other agents, be evaluated, and be kept safe. Trigger this skill any
  time the user asks about agent design patterns, ReAct vs Plan-and-Execute vs Reflection, how
  many agents a system should have, multi-agent orchestration or handoff, agent memory
  architecture, how to evaluate or test an agent, agent guardrails or prompt injection defense,
  or which agent framework (LangGraph, Mastra, Vercel AI SDK, eve, CrewAI, OpenAI Agents SDK,
  Google ADK) fits a given use case - even if they only describe symptoms like "my agent loops
  forever," "my agent burns too many tokens," or "my agent picks the wrong tool." This is a
  framework-agnostic companion to implementation-specific skills (e.g. vercel-ai-sdk); use both
  together when the user is building on a specific SDK.
---

# Agentic AI Design Patterns — Framework-Agnostic Reference

A skill for the architectural layer of agent building: the decisions that sit above any specific SDK. Most production agent failures are architectural, not model-quality failures — the model behaved as expected, but the system around it (planning shape, memory, coordination, guardrails, evaluation) wasn't designed to contain that behavior. This file is organized so you can jump straight to the failure mode you're facing.

---

## 1. Core Reasoning Patterns — how a single agent thinks

Pick the reasoning pattern before writing any orchestration code. All three descend from the same 2022–2023 research lineage and cover ~90% of production single-agent shapes.

### ReAct (Reason + Act)
- **What it is:** The agent alternates: think about what to do → call a tool → observe the result → think again, in a loop, until done.
- **When to use it:** Tasks where you don't know the plan upfront and need adaptive, step-by-step tool use — customer support diagnosis, exploratory research, anything where the next step depends on what the last tool call returned. Most widely deployed pattern because it's auditable: every thought/action/observation triple is inspectable.
- **Failure mode to watch:** Re-deriving the same plan on every request. If you notice the agent "thinking through" an identical decomposition every time for a recurring task type, that's the signal to move to Plan-and-Execute instead.

### Plan-and-Execute
- **What it is:** The agent creates a full plan upfront, then executes the steps — optionally revising the plan if a step's result invalidates a later one. Separates high-level planning (needs a strong/expensive model) from tactical execution (can use a smaller/cheaper model per step).
- **When to use it:** Complex multi-step workflows with a decomposition that's knowable in advance — quarterly report generation, multi-source data pipelines. Reported production numbers: ~92% task completion with meaningfully faster wall-clock than pure ReAct, because execution steps parallelize and can run on cheaper models.
- **Failure mode to watch:** A plan that goes stale mid-execution because reality diverged from the assumption baked in at planning time, with no revision step to catch it.

### Reflection
- **What it is:** After producing a result, the agent (or a separate reflector call) evaluates its own output against a quality bar and retries if it falls short. An outer loop layered around ReAct or Plan-and-Execute, not a replacement for either.
- **When to use it:** Add this when final-answer quality matters more than latency or cost — content generation, code review, anything where "good enough on the first try" isn't reliable enough. Common combination: Tool Use + ReAct (adaptive research) + Reflection (self-critique of the draft) + Sequential Workflow (research → draft → review → format).
- **Failure mode to watch:** Unbounded reflect-retry loops with no cap — set a max retry count or cost budget, or a bad first draft becomes a runaway bill.

### Decision shortcut
- Single-step task, need external data → **Tool Use** alone (no loop needed).
- Single-step, self-contained, quality is the bottleneck → **Reflection** alone.
- Multi-step, decomposition known upfront → **Planning / Plan-and-Execute**.
- Multi-step, decomposition emerges during execution → **ReAct**, or **Orchestrator-Worker** if it also needs delegation (see §2).
- Multiple perspectives/roles needed → **Multi-Agent Collaboration** (see §2).
- Output quality is the primary constraint regardless of shape → layer an **Evaluator-Optimizer** (Reflection variant) on top.

Real systems rarely use exactly one pattern — treat the list above as composable layers, not mutually exclusive choices.

---

## 2. Multi-Agent Orchestration — when one agent isn't enough

**First, check whether you need multi-agent at all.** Independent benchmarking has found a single agent matches or beats multi-agent systems on roughly two-thirds of tasks when given the same tools and context; multi-agent typically adds a couple of accuracy points at roughly double the cost. Default to single-agent-with-tools; only split into multiple agents when you have a concrete reason from the list below.

### The pattern that survived: Orchestrator + isolated subagents
By 2026, the converged default across major vendors (Anthropic, OpenAI, Cognition, LangChain, Microsoft) is: **a single orchestrator holds full conversation context and spawns ephemeral, isolated subagents that return compressed summaries — no peer-to-peer chatter.** Free-form peer "group chat" patterns lost ground because they produce infinite handoff loops and context pollution. If you're designing a new multi-agent system in 2026, start here unless you have a specific reason not to.

Four rules that matter most in production:
1. **Dedicated system prompt per subagent role** — never reuse the orchestrator's prompt for a worker; role-scoped context prevents scope creep and confused tool selection.
2. **First message to a subagent is a structured brief** — objective, format, tools, boundaries. Free-form delegation ("go figure it out") is a documented failure mode.
3. **Subagents return a summary, not a full transcript.** Inlining the full transcript back into the orchestrator burns tokens at roughly 15x the rate of a summary and pollutes context.
4. **Forward worker output directly to the user when the orchestrator's only job is to relay it** — don't paraphrase-through-a-second-LLM-call when it adds no value. This single change accounts for roughly half the measured performance gain of supervisor patterns over swarm patterns.

### Other topologies (use only when Orchestrator-Worker doesn't fit)

| Pattern | Shape | Use when | Known failure mode |
| :--- | :--- | :--- | :--- |
| **Sequential pipeline** | Fixed linear steps, each depending on the last | Order never changes (research → draft → review → format) | Any step failure blocks the whole chain; add retries per step |
| **Fan-out / fan-in** | Parallel independent branches, merged at the end | 4+ independent subtasks with no dependencies | Merge-step complexity scales with branch count |
| **Dynamic handoff (swarm)** | Peers hand off to each other directly, no central coordinator | Right specialist can't be known until the conversation unfolds (support ticket that turns out to be billing, not technical) | Infinite handoff loops (A→B→C→A); cap handoff depth |
| **Hierarchical** | Multi-level supervisors, tree-shaped delegation | Very large task decomposition where a single orchestrator would be a bottleneck | Coordination overhead compounds per level; adds latency |
| **Blackboard** | Independent agents read/write a shared workspace, no direct handoff | Agents are owned by different teams with different release cadences; forcing a single supervisor would create a cross-team bottleneck | Requires strong shared-schema discipline or agents step on each other's writes |
| **Debate / maker-checker** | Two+ agents argue, a judge resolves | Accuracy matters more than speed, especially verification-heavy tasks | Cost roughly doubles for a modest accuracy gain — only worth it when errors are expensive |

### Decision checklist
- Known task decomposition, want one accountability point → Orchestrator-Worker.
- Fixed linear steps → Sequential pipeline.
- Independent parallel work → Fan-out/fan-in.
- Need quality verification specifically → Debate/maker-checker.
- Can't predict routing until runtime → Dynamic handoff (accept the loop-risk, cap it).
- Plan itself needs to be discovered, not just executed → Adaptive planning / ReAct at the orchestrator level.

---

## 3. Memory Architecture

Production agents need up to four memory types — don't build only one and call it "memory":

- **Working memory** — the current context window. Always in scope, most expensive per-token, most volatile.
- **Episodic memory** — specific past events/sessions ("the user asked about refunds last Tuesday"). Needed for continuity across sessions.
- **Semantic memory** — extracted, consolidated facts and preferences ("the user prefers email over SMS"). Usually derived from episodic memory over time (consolidation).
- **Procedural memory** — the agent's own learned instructions/skills, updated over time rather than re-prompted every session.

### The dominant production pattern: tiered memory
A small always-in-context core (recent turns, key facts) + a vector-store-backed retrieval layer for everything else + an explicit forgetting/eviction policy. This is the OS-style approach popularized by MemGPT/Letta: treat the context window like RAM and the retrieval store like disk, paging relevant memories in as needed.

### Picking a memory backend
- **Pure semantic similarity search** (e.g. a vector DB alone) — fine for single-type recall (facts, preferences) at small-to-medium scale.
- **Vector + graph hybrid** (e.g. vector DB + graph DB) — use when you need both semantic retrieval *and* multi-hop relational reasoning ("what's connected to what"), typically at 1M–100M record scale.
- **Managed memory frameworks** (Letta, LangMem, Mem0, Zep as of 2026) — reach for these instead of hand-rolling memory logic. Rough rule of thumb from current comparisons: LangMem if you're already on LangGraph, Letta for explicit OS-style memory control, Mem0 for the fastest managed integration, Zep when temporal awareness and knowledge-graph structure matter specifically.

### Security note — memory is now an attack surface
Writable agent memory introduces a poisoning risk: an attacker can implant false "facts" that persist across sessions and later bias the agent's behavior (OWASP LLM04 territory). Treat memory writes with the same suspicion as tool inputs — validate/sanitize before persisting, and don't let untrusted content (scraped pages, incoming emails) write directly to long-term memory without a review step.

---

## 4. Evaluating and Testing Agents

Agent evaluation happens at three levels — don't stop at the first one:

1. **End-to-end / outcome** — did the task succeed at all?
2. **Trajectory-level** — was the path taken efficient and sound (right tools, right order, no wasted steps)? This is where most of the real diagnostic signal lives — outcome-only eval can't tell you *why* something failed.
3. **Component-level** — which specific piece broke (a particular tool, a particular sub-agent, the retriever)?

### Scoring mix
A commonly recommended split: roughly 60% deterministic checks (exact match, regex, JSON-schema validation, latency thresholds — fast, free, unambiguous), 30% LLM-as-judge (for open-ended quality where there's no single right answer), 10% human review for the genuinely ambiguous cases. Never rely on LLM-as-judge alone — it adds its own stochasticity on top of the agent's, so pair it with deterministic ground-truth checks wherever possible.

### Process discipline
- **Baseline before setting an acceptance bar.** Score the current production agent on a golden dataset first; never pick a threshold out of thin air.
- **Block on regression, not on an absolute number** — e.g. "tool-selection accuracy currently 88%, don't ship below that" rather than an arbitrary 95%.
- **Run evals on every PR that touches agent code or prompts**, same as unit tests; a failed eval blocks merge.
- **Continuous eval in production, not just pre-deploy**: sample a small percentage of live traffic for expensive LLM-as-judge scoring, run cheap deterministic checks on all traffic, and fold in user feedback (thumbs up/down) as another signal. This is what catches quality drift that a one-time offline eval will miss.

### Tooling landscape (2026)
Open-source: DeepEval (pytest-integrated, broad metric library, good CI fit). Observability-adjacent: Langfuse, Helicone, Arize Phoenix (drift detection). Managed: LangSmith (deepest with LangChain/LangGraph), Confident AI, Braintrust. Pick based on which framework you're already in rather than metric-list completeness — most of these cover the same core ground.

---

## 5. Guardrails and Safety Design

The core principle for 2026-era agent safety: **guardrails must live in the architecture, not only in the prompt.** Prompt-level instructions ("don't do X") operate at the same level of abstraction as the attacks trying to defeat them, and degrade further as context grows (long conversations are measurably easier to manipulate through gradual drift). Treat prompt instructions as a weak first layer, never the only layer.

### Layered defense (apply as many as are relevant to your agent's blast radius)
1. **Input handling** — separate trusted instructions (your system prompt) from untrusted content (retrieved documents, tool outputs, user-pasted text) at the data-structure level, not just by convention. This is the single highest-leverage defense against indirect prompt injection.
2. **Pre-LLM checks** — deterministic, fast filters before the model ever sees the input: known-bad patterns, PII/secret redaction, disallowed-intent blocking. Keep these fast since they run in the hot path of every call.
3. **Capability sandboxing** — run tool execution (especially code execution) in an isolated environment with no unnecessary network/filesystem access, mediated through a gateway rather than direct system calls.
4. **Least-privilege tool access** — scope each agent/tool to the minimum permissions it needs; don't give a summarization agent the same credentials as a database-write agent.
5. **Approval gates on sensitive actions** — human-in-the-loop confirmation before destructive or high-stakes actions (see `needsApproval`-style patterns), with the approval function itself allowed to be conditional (auto-approve safe inputs, escalate risky ones).
6. **Output filtering** — validate structure and content *before* acting on a tool's or model's output, not just before it reaches the user; a hallucinated tool argument can be as dangerous as a hallucinated final answer.
7. **Continuous observability** — log and trace every step so a successful attack or failure is diagnosable after the fact, not just prevented (imperfectly) beforehand.

### Multi-agent-specific risk
A successful injection at one layer of a multi-agent system propagates to every downstream agent that consumes its output — treat inter-agent messages with the same suspicion as external input, not as trusted internal state. This is a documented, measured propagation risk, not a theoretical one.

### Design stance
Assume every individual detector will sometimes fail. The resilient designs are the ones where a single filter miss doesn't equal a compromised system — that means combining deterministic pre-checks, policy-enforced least-privilege execution, post-hoc validation, and monitoring, rather than betting everything on one clever prompt or one classifier.

---

## 6. Framework Selection (as of mid-2026)

Match the framework to your language and your actual complexity — not to hype. A recurring theme across current comparisons: pick based on what the framework *actually handles for you* (durability, memory, evals, orchestration primitives) versus what you'll still build yourself.

| Your situation | Reach for |
| :--- | :--- |
| TypeScript, simple chat UI + single tool loop, no durability/memory needs | **Vercel AI SDK** — best-in-class for streaming to React/Vue/Svelte; not an orchestration framework, don't force it to be one |
| TypeScript, need durable workflows, built-in memory, evals as first-class primitives | **Mastra** — TS-native answer to "AI SDK doesn't do orchestration"; serverless-first (Vercel/Cloudflare/Netlify) |
| TypeScript, want a file-based "Next.js for agents" convention, default to Vercel infra | **eve** — agents defined as directories, durable execution/sandbox/approvals/evals bundled by convention |
| Python, complex branching, need durable/resumable execution, most mature observability story | **LangGraph** — steepest learning curve of the mainstream options, but the deepest checkpointing/replay/human-in-the-loop support |
| Python, role-based multi-agent prototyping, minimal boilerplate | **CrewAI** — fastest to a working demo; plan to migrate to LangGraph if it needs to scale into something with complex branching |
| Simple single-agent tool loop, staying inside one provider's ecosystem | **The provider's own SDK** (OpenAI Agents SDK, etc.) — real integration savings, real lock-in; a fair trade only if you're committed to that provider |
| .NET / enterprise Microsoft stack | **Semantic Kernel** |
| Non-technical or mixed teams needing a visual builder | **n8n** or **Vellum** — pair with a code-first framework underneath for the parts that need real orchestration |

### A simpler test before adopting any agent framework at all
Sketch the control flow as a state diagram. If it has fewer than ten states, every transition is deterministic, and the LLM calls are cleanly scoped to specific states — just write a state machine (even a plain reducer or switch statement) with a plain SDK at the call sites. Skip the agent framework entirely. Reach for a full framework only once the state space is large, branching, or non-deterministic enough that its checkpointing and orchestration primitives earn their overhead. A large share of "agent" projects in production codebases didn't need to be agents — or didn't need a framework — in the first place.

---

## 7. Prompt Engineering for Agentic Systems

Agent prompts differ from single-shot prompts in three ways: they must define decision-making authority (when to act vs. ask vs. refuse), they persist across many turns (so drift and injection risk compound), and they coordinate with tools/other agents (so scope has to be explicit, not implied).

### Patterns that hold up in production
- **Role + explicit constraints per agent** — especially critical in multi-agent systems; sharing one prompt across agents is a documented cause of scope creep and confused tool selection (see §2).
- **Tool-selection heuristics in the prompt** — don't just list tools, tell the agent *when* to prefer one over another and when to prefer no tool at all.
- **Trusted vs. untrusted context, stated explicitly** — the prompt should say plainly what counts as an instruction (system/developer text) versus data to reason about (retrieved documents, tool results, user-pasted content), and what to do when retrieved data is incomplete or contradictory. This is a direct prompt-level complement to the input-handling guardrail in §5.
- **Error recovery instructions** — what the agent should do when a tool call fails, returns unexpected data, or a step's precondition isn't met, rather than leaving failure-path behavior undefined.
- **Examples covering edge cases, not just the happy path** — decision patterns like when to ask for clarification, how to handle missing parameters, and when to refuse, taught via examples rather than abstract rules.

### The anti-pattern to avoid
Treating the system prompt as the *only* safety mechanism (see §5) — a well-written prompt reduces the frequency of bad behavior but does not bound the worst case; architecture (sandboxing, least privilege, approval gates) has to carry that load instead.

---

## 8. Cross-Cutting Anti-Patterns (check these first when something's broken)

- **Multi-agent when single-agent would do** — added cost and coordination overhead for a small, inconsistent accuracy gain (§2).
- **Shared system prompt across multiple agent roles** — causes scope creep and tool-selection confusion (§2, §7).
- **Full-transcript handoffs instead of summaries** — burns tokens at roughly 15x the rate and pollutes downstream context (§2).
- **Unbounded reflection/retry loops** — no cap on cost or iteration count (§1).
- **Free-form peer delegation ("swarm") without a loop cap** — the single most common cause of infinite agent-to-agent handoffs (§2).
- **Prompt-only safety** — no architectural guardrail behind the instruction (§5, §7).
- **Memory with no forgetting policy or write-validation** — unbounded growth and a poisoning surface (§3).
- **Outcome-only evaluation** — can't diagnose *why* an agent failed, only *that* it did (§4).
- **Adopting a heavy orchestration framework for a state space that's genuinely small and deterministic** — a plain state machine would have been simpler, cheaper, and easier to onboard new engineers into (§6).

---

## When you're not sure

This field moves in months, not years — a framework comparison from six months ago may already be stale, and new memory/eval/guardrail tooling ships constantly. Treat the frameworks, benchmark numbers, and product names in this file as a mid-2026 snapshot: verify current state with a web search before making a hard commitment (framework choice, memory backend, eval platform) rather than trusting this file as permanently current. The reasoning patterns in §1, §2, and §7 are architectural and much more durable than the tooling landscape in §4 and §6.
