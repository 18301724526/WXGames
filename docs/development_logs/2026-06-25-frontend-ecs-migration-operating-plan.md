# Frontend ECS Migration Operating Plan - 2026-06-25

## Purpose

The migration matrix defines the destination. This document defines how the project can move toward that destination without freezing all bug fixes and feature work for months.

This is still not a file-by-file implementation guide. It is an operating plan: ownership rules, sequencing rules, dual-track policy, acceptance gates, rollback policy, and stop-loss criteria.

## Reality Check

The current frontend cannot be treated as a clean ECS candidate. The migration must assume:

- No ECS core dependency exists yet.
- Many state facts are mirrored across app, shell, canvas shell, last game, and state snapshots.
- Prototype/mixin installation makes static dependency analysis incomplete.
- Renderers often participate in hit-target generation and sometimes influence input behavior.
- Mode checks are scattered across production files.
- Temporary compatibility code can become permanent unless explicitly time-boxed.

The operating plan therefore treats old-owner retirement as the main deliverable.

## Migration Objective

The target is not to make every file "use ECS". The target is to make every frontend responsibility have one declared owner and to make legacy owners unable to grow.

Each migration batch must end in one of three states:

| State       | Meaning                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| Sealed      | Old owner retired or read-only mirrored, new ECS owner active, guards block old-path growth |
| Report-only | Old owner still active, but inventory and guard report exist                                |
| Rolled back | New path disabled/removed, old behavior restored, no mixed ownership remains                |

A batch is not allowed to end in "mixed but unguarded".

## Sequencing Rule

Do not sequence by perceived bug priority. Sequence by dependency topology and ability to seal ownership.

The order below is the required operating sequence:

| Batch                                              | Goal                                                                              | Why It Comes Here                                                             | Expected Window   | Exit Criteria                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| 0A. Mode and Bridge Inventory                      | Produce mode boolean and bridge/prototype inventory                               | These are the main infection sources and must be known first                  | 1 week            | Mode and bridge reports exist; old owners and mirrors are named           |
| 0B. Authority, Input, Literal, Duplicate Inventory | Produce renderer authority, input branch, literal, and duplicate inventories      | Completes the baseline needed for guard rollout                               | 1-2 weeks         | Reports exist; new violations can be distinguished from historical debt   |
| 1. ECS Core ADR and Gate                           | Confirm external ECS library and block self-built core                            | Prevent a second homegrown architecture                                       | 1 week            | ADR accepted; dependency added only after gate design exists              |
| 2. ECS Boundary Skeleton                           | Establish component/system/mode naming and read-only bridge policy                | Gives all later batches a target vocabulary                                   | 1-2 weeks         | No gameplay migration yet; guards can recognize ECS owner paths           |
| 3. Mode Ownership Spine                            | Create the single mode stack and modal subtype ownership                          | Mode booleans are the main spread vector                                      | 2-3 weeks         | New mode decisions cannot be added outside mode owner paths               |
| 4. Input Intent Boundary                           | Route physical input through explicit intent and mode resolver                    | Input is where old mode logic keeps re-entering                               | 2 weeks           | Input routers become physical adapters for covered modes                  |
| 5. Panel/Modal Ownership                           | Seal naming, event, reward reveal, confirm dialog, target picker, blocking panels | These are concrete old booleans and high-risk blockers                        | 2 weeks           | Covered modal subtypes no longer have app/shell as source of truth        |
| 6. Snapshot Boundary                               | Make renderers consume explicit snapshots for covered modes                       | Renderer authority cannot be removed until snapshot contract exists           | 2 weeks           | Covered renderers cannot read authoritative mode/panel state directly     |
| 7. Domain Area Sealing                             | Migrate one domain area at a time                                                 | Domain-specific work must happen after global mode/input/snapshot paths exist | 10-20 weeks total | Each domain area ends sealed or rolled back                               |
| 8. Bridge Retirement                               | Remove or shrink temporary facades and mirrors                                    | Prevent permanent compatibility mud                                           | 2-4 weeks         | Expired bridges fail guard; allowed bridges have active lifecycle records |

The batches are ordered, but batches 5-7 can repeat per domain area after the global spine is in place.

## Domain Sealing Order

Batch 7 must not pick domain order by frustration level. Use dependency and blast radius.

| Order | Domain    | Reason                                                                                                                                                                 |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Battle    | Most isolated compared with city/world/tutorial and useful for validating ECS state, animation, and snapshot patterns with lower blast radius                          |
| 2     | City      | Moderate dependency surface; validates panels, building/city state, and server DTO snapshot consumption before the world-map work                                      |
| 3     | World Map | Largest and most coupled surface; should start only after mode, input, modal, and snapshot boundaries are proven                                                       |
| 4     | Formation | Depends on city/military state and participates in world-march flow; should reuse city/world-map ownership patterns                                                    |
| 5     | Tutorial  | Depends on every other domain for focus targets, allowed actions, and guided transitions; should migrate last so it can point at ECS-owned state instead of old owners |

If evidence shows a domain has a smaller sealed slice that can be completed without mixed ownership, it may be split, but the split must preserve the same dependency logic.

## Expected Timeline

The complete frontend ECS migration is a multi-month program, not a short bugfix.

| Scope                                                        | Expected Window |
| ------------------------------------------------------------ | --------------- |
| Inventory and baseline                                       | 2-3 weeks       |
| Core ADR, boundary skeleton, mode/input/modal/snapshot spine | 8-12 weeks      |
| Domain area sealing                                          | 10-20 weeks     |
| Bridge retirement and stabilization                          | 2-4 weeks       |
| Total migration program                                      | 24-36 weeks     |

This timeline does not require feature work to stop for 24-36 weeks. It does require feature work to obey the dual-track policy and sealed-area rules during the migration window.

## Dual-Track Policy

During migration, the project may run old and new paths only under strict ownership rules.

| Work Type                      | Allowed Path During Migration                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Critical production bug        | May touch old path if it preserves behavior, but must add inventory evidence and must not add new unowned state |
| Bug in a migrated/sealed area  | Must fix through ECS owner or sealed adapter; old path may only be deleted or read-only mirrored                |
| New feature in unmigrated area | Allowed only if it registers ownership debt and does not create new duplicate owner patterns                    |
| New feature in migrated area   | Must use ECS owner path only                                                                                    |
| Refactor-only cleanup          | Must reduce violation count or retire a bridge                                                                  |

Feature flags may select old or new behavior during a batch, but feature flags are not a substitute for retirement. A feature flag that keeps both source-of-truth paths alive after a batch is a failed batch.

## Bridge Policy

Every bridge must be time-boxed and tracked.

| Rule           | Requirement                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------- |
| Max lifetime   | Two migration batches or 14 calendar days                                                     |
| Allowed work   | Forward old public calls, mirror old fields read-only, preserve boot compatibility            |
| Forbidden work | New business branches, new source-of-truth fields, new mode decisions, new renderer authority |
| Extension      | Requires written exception, owner, new date, and a guard that blocks further growth           |
| Expiration     | New feature work cannot call an expired bridge                                                |

Bridge lifecycle records may live in the operating log or in a machine-readable manifest once gates are added.

## Rollback Policy

Rollback must restore one source of truth, not leave both paths alive.

| Scenario                                     | Rollback Action                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| New ECS owner fails before old owner retired | Disable/remove new owner and keep old path unchanged                                                  |
| New ECS owner fails after old owner retired  | Re-enable old owner only from the last sealed backup/commit, then record the failed seal reason       |
| Bridge creates behavior drift                | Freeze bridge expansion, route all fixes to owner decision, retire or roll back within the same batch |
| Performance regression                       | Revert the batch or disable the new system behind a flag while keeping ownership single-source        |

Rollback is successful only when tests pass and the ownership report shows no additional mixed-source state compared with the batch start.

## Guard Rollout

Guards must start as report-only where historical debt is large, then become blocking for new violations.

| Guard                     | Phase 1                                                   | Phase 2                             | Phase 3                            |
| ------------------------- | --------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| ECS core guard            | Blocking immediately                                      | Blocking                            | Blocking                           |
| Component purity guard    | Report all, block new ECS components with runtime objects | Block new violations                | Blocking                           |
| Mode ownership guard      | Report scattered mode checks                              | Block new mode checks outside owner | Blocking for sealed areas          |
| Renderer authority guard  | Report renderer state writes                              | Block new writes in sealed areas    | Blocking for all renderer adapters |
| Duplicate owner guard     | Baseline duplicate logic                                  | Block new duplicate owner patterns  | Reduce baseline per batch          |
| Hardcoded literal guard   | Baseline literals                                         | Block new unowned literals          | Reduce baseline per domain         |
| Boundary dependency guard | Report dependency cycles/reverse deps                     | Block new reverse deps              | Blocking                           |
| Bridge shrink guard       | Report bridge size/branches                               | Block expired bridge expansion      | Blocking                           |

The first useful gate is not "zero historical violations". The first useful gate is "no new unowned mess".

## Acceptance Template

Every migration batch must answer these questions before it is accepted:

1. What is the old owner being retired?
2. What is the new ECS owner?
3. What legacy fields/methods remain as read-only bridge surface?
4. Which guard prevents this old path from growing again?
5. What tests prove behavior stayed intact?
6. What rollback restores a single source of truth?
7. Which bridge expires next?

If any answer is missing, the batch is not sealed.

## Stop-Loss Criteria

The migration must pause for reassessment if any of these happen:

- A batch ends with more mixed ownership than it started with.
- A bridge passes its max lifetime without an exception and guard.
- A migrated area requires a new bug fix through the old source-of-truth path.
- Performance smoke shows a material regression that cannot be isolated behind a single system.
- New feature work adds mode/panel/camera state outside declared owners.

Pause does not mean abandon ECS. It means stop expanding scope until ownership is single-source again.

## Team Operating Rules

- One migration owner must review every frontend change that touches mode, input, renderer state, tutorial, panel/modal, or world-map runtime during migration.
- Every bug fix must state whether it touches a sealed, report-only, or unmigrated area.
- Every new state field must declare its owner role before merge.
- Every new renderer access to state must be justified as snapshot input, not authority.
- Every exception must have a retirement date.

## Practical First Deliverable

Before migrating gameplay behavior, produce the following report-only inventories:

0A first-week deliverables:

- Mode boolean inventory: all `activeTab`, `militaryView`, `show*`, `entityBattle`, `techDetailOpen`, `armyFormationEditor`, `naming`, `rewardReveal`, `confirmDialog`, `activeEventId` owners and mirrors.
- Bridge inventory: facade/mixin installers and prototype augmentation surfaces.

0A record format:

Mode inventory rows must use this schema:

| Symbol      | File              | Line | Role                                                              | Access                          | Evidence           | Note   |
| ----------- | ----------------- | ---- | ----------------------------------------------------------------- | ------------------------------- | ------------------ | ------ |
| `activeTab` | `path/to/file.js` | `1`  | `source-of-truth` / `mirror` / `consumer` / `adapter` / `unknown` | `read` / `write` / `read-write` | short code context | reason |

Bridge inventory rows must use this schema:

| Bridge                    | File              | Line | Installer/Surface         | Fields     | Methods     | Branch Count       | Role                 | Retirement Target | Note   |
| ------------------------- | ----------------- | ---- | ------------------------- | ---------- | ----------- | ------------------ | -------------------- | ----------------- | ------ |
| `CanvasGameApp.prototype` | `path/to/file.js` | `1`  | installer or surface type | field list | method list | branch token count | `bridge` / `adapter` | target owner      | reason |

0A execution checklist:

| Step                                   | Status    | Artifact / Gate                                                               | Acceptance Standard                                                                                                                 |
| -------------------------------------- | --------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0A-1. Mode boolean inventory           | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md` | Every finding has file, line, role, access, evidence, and note                                                                      |
| 0A-2. Bridge inventory                 | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0a-bridge-shrink-baseline.md`  | Every bridge candidate has owner surface, fields, methods, branch count, and retirement target placeholder                          |
| 0A-3. Mode ownership report-only guard | Completed | `scripts/report-frontend-ecs-mode-ownership.js`                               | Guard scans current code and exits 0 with historical findings                                                                       |
| 0A-4. Bridge shrink report-only guard  | Completed | `scripts/report-frontend-ecs-bridge-shrink.js`                                | Guard scans current code and exits 0 with historical findings                                                                       |
| 0A-5. Migration owner review           | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md`         | `codex/external-review` passed review at `2026-06-25 14:01:38 +08:00`                                                               |
| 0A-6. Progress document update         | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md`         | Status records 0A as completed after owner review                                                                                   |
| 0A-7. Operating plan update            | Completed | this document                                                                 | 0A status and artifacts are recorded as completed without starting 0B early                                                         |
| 0A-8. Commit and server branch push    | Completed | git history and server remote                                                 | Completion and deploy-gate formatting commits were pushed; refactor test server deployed `87876c1a6e37ace396759201c503a9aeb3f21a2f` |

0A acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- 0A moved from `Ready for migration owner review` to `Completed` after `codex/external-review` reviewed the inventory documents and recorded sign-off in the progress document.
- 0B can start after the server branch has deployed `87876c1a6e37ace396759201c503a9aeb3f21a2f`.

0B second-window deliverables:

- Renderer authority inventory: renderer writes to app/shell/state/controller fields.
- Input branch inventory: mode/panel/tutorial checks inside input routers and action dispatch paths.
- Literal/duplicate inventory: magic numbers, action strings, API paths, asset paths, repeated helper logic.

Only after these inventories exist should the project start sealing ownership batches.
