---
name: architecture-refactor
description: "Project-wide decoupling refactor — server = ABCD module pipelines, client = ECS, both sharing pure shared/ rules, mandatory per-stage observability. Living plan in docs/architecture/."
metadata: 
  node_type: memory
  type: project
  originSessionId: 203faf18-7d63-42bc-9dce-edfca1b28aff
---

⚠️ 本文的迁移计划与 M0/M1 里程碑编号已被 7月14日后端架构/ 的 v2.3 参考架构+M0-M7 迁移路线图取代（两套编号同名不同义，勿混用）；客户端 ECS（bitecs+单画布）与 fog 切片均已落地。仅原则部分（规则单源 shared/、薄调用层、每级 trace）仍有效。

Decided 2026-06-25 (user, after the world-march passability mess). The whole project is being refactored toward total decoupling, **incrementally (strangler-fig, not big-bang)** because the user is fed up with "fix one bug → touch N files → cause N new bugs".

- **Server = ABCD module pipelines**: D=data source (pure fetch), **C=rules (pure functions, ALL rules for a concern in ONE file)**, B=orchestration (calls C, no rules), A=presentation/dispatch (no rules).
- **Client = ECS** (entities=ids, components=pure data, systems=logic). Designed, not yet implemented (M0 = ECS infra is the next foundational step).
- **Both halves share the SAME pure rule modules in `shared/`** (UMD, Node+browser): server's C-layer and client's Systems call the same file. Rule lives in exactly one place — e.g. [[world-march-passability]] → `shared/worldMarchPassability.js`.
- **Mandatory observability**: every C/System/stage emits a structured `in/out` trace + correlation id (reuse `WorldMarchTrace`/`ClientOperationLog`/`LogService`/`WorldExplorerTrace`). Today coverage ≈15-20%; the goal is to never debug by "add a log and re-reproduce".
- **North star**: fix any bug WITHOUT a global search. Acceptance: change a rule = edit one file; locate any bug from existing trace.

Docs (authoritative + living — keep the plan's progress table in sync as work lands):
- `docs/architecture/module-pipeline-and-observability-standard.md` (the ABCD + observability standard)
- `docs/architecture/client-ecs-architecture.md` (client ECS design)
- `docs/architecture/refactor-plan.md` (**living** plan: migration order from the 22-subsystem audit + progress)

First pipeline migrated (M1, done + deployed 69e28734): world-march passability — see [[world-march-passability]]. Next priorities (audit): fog vision (`WorldFogVisionModel` vs backend — dup rule), `BuildingState` (front/back dup), territory durations, then M0 ECS infra.

**Why:** the current codebase smears one rule across ~9 files in two languages; unmaintainable. **How to apply:** any new/changed feature must follow the standard — rule in one `shared/` C file, thin callers, per-stage trace; update the refactor-plan progress table; never duplicate a rule across runtimes.
