# Command Owner Pipeline Step2 Prerequisite Admission Tasks

Status: Draft v0.1, derived task list
Date: 2026-07-09
Source spec: `step2-command-owner-pipeline-prerequisite-admission-spec-2026-07-09.md`
Contract oracle: `command-owner-pipeline-contract-test-spec-2026-07-09.md`
Step1 inputs: `step1-command-owner-pipeline-prerequisite-staging-spec-2026-07-09.md`, `step1-command-owner-pipeline-prerequisite-staging-tasks-2026-07-09.md`

## 1. Purpose

This task list turns the Step2 admission gate into executable review work.

Step2 does not implement pipeline code. It admits or rejects whether Step1
evidence is strong enough to start Step3 formal implementation without allowing
fake compliance.

## 2. Step2 Rules

- No code implementation.
- No temporary fixes.
- No allowlist expansion as a substitute for evidence.
- No acceptance based on broad scanner output alone.
- Every admission judgment must cite `COP-*` contract ids.
- Any unknown answer is a failure, not a pass.

## 3. Tasks

### STEP2-T01: Freeze Admission Inputs

Contract ids: all `COP-*`.

Inputs:

- Contract oracle
- Step1 staging spec
- Step1 task outputs
- architecture smoke output
- inventories, reports, classifications, fixtures, and debt records

Action:

- Record the exact evidence package under review.
- Confirm each Step1 report has run from the shared smoke entry.
- Confirm every evidence item maps to `COP-*`.

Output:

- Admission input manifest.

Pass condition:

- The reviewer can reproduce the same evidence package from documented commands.

Fail condition:

- Evidence exists only as manual notes or untracked ad hoc output.

### STEP2-T02: Verify Contract Coverage

Contract ids: all `COP-*`.

Inputs:

- Contract coverage index from Step1
- Contract Test Matrix

Action:

- Check every `COP-*` id has Step1 evidence.
- Check every Step1 report declares its covered contract ids.
- Check every uncovered contract id has an explicit blocker and owner.

Output:

- Contract coverage verdict.

Pass condition:

- No unmapped contract ids.

Fail condition:

- A contract id depends on future Step3 work without Step1 visibility.

### STEP2-T03: Review Server Write Entry Coverage

Contract ids: `COP-ENTRY-001`, `COP-ROUTE-001`.

Inputs:

- Server write-entry inventory
- route orchestration report

Action:

- Confirm every route, worker, service, and helper entry that can persist state
  is represented.
- Confirm helper wrappers preserve the original route-owned orchestration debt.

Output:

- Server entry coverage finding list.

Pass condition:

- Every required route is covered, including `/api/game/action`,
  `/api/game/tasks/claim`, `/api/game/heartbeat`, `/api/buildings/build`,
  `/api/player/login`, and `/api/player/reset`.

Fail condition:

- A write entry is hidden behind a helper or classified only as false positive.

### STEP2-T04: Review Frontend Command Path Coverage

Contract ids: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-ENTRY-001`.

Inputs:

- Frontend command-path inventory
- client command-domain reports
- client disabled command-path report

Action:

- Confirm every write-capable frontend path is classified.
- Trace disabled, ready, busy, eligible, can*, cooldown, claimable, and saving
  producers to command-submit consumers.

Output:

- Frontend command path admission findings.

Pass condition:

- Every domain blocker is either visible debt or absent from command-submit
  paths.

Fail condition:

- A renderer, panel, controller, shell, app, or API path can suppress command
  submission based on domain state without debt classification.

### STEP2-T04B: Review Frontend Write Submission Bypass Coverage

Contract ids: `COP-ENTRY-001`, `COP-CLIENT-002`, `COP-ENVELOPE-001`,
`COP-IDEMP-001`.

Inputs:

- frontend write-submission bypass report
- frontend command-path inventory
- `GameAPI` helper inventory

Action:

- Confirm every frontend direct write submit call is represented.
- Confirm direct submit paths are classified as sender facades, visible legacy
  debt, intent-only, or false positives with evidence.
- Confirm legacy direct submissions cannot be hidden by moving calls between
  app, controller, panel, renderer, compatibility helper, or `GameAPI`.

Output:

- Frontend write-submission bypass admission findings.

Pass condition:

- Step3 can introduce or verify a universal sender without rediscovering direct
  write call sites.

Fail condition:

- Any `api.*`, `getGameApi().*`, controller, panel, or game-body write submit
  path is unclassified or incorrectly treated as already migrated.

### STEP2-T05: Review Local Block Semantics

Contract ids: `COP-CLIENT-001`, `COP-AUTHORITY-001`, `COP-TIME-001`.

Inputs:

- Client local-block classification table

Action:

- Confirm only `IN_FLIGHT`, `DUPLICATE_COMMAND_ID`, `PAYLOAD_SHAPE`, and
  `UI_NOT_READY` are allowed command-submit blockers.
- Confirm domain blockers are not renamed into allowed categories.

Output:

- Local block semantics verdict.

Pass condition:

- Domain eligibility is display-only or classified as visible debt.

Fail condition:

- Resources, era, tech, cooldown, march, candidate, territory, reward,
  encounter, loot, or boss state blocks command submission without debt.

### STEP2-T06: Review Owner Key Coverage

Contract ids: `COP-OWNER-001`, `COP-OWNER-002`, `COP-SHARED-001`.

Inputs:

- Owner-key coverage report
- owner decision table
- shared-owner write coverage

Action:

- Confirm every current write command resolves one owner key or has an explicit
  owner-resolution blocker.
- Confirm missing shared target ids fail owner resolution.
- Confirm territory and encounter decisions are explicit.

Output:

- Owner admission findings.

Pass condition:

- No command relies on generic `player:{playerId}` fallback when shared target
  ids are required.

Fail condition:

- Fake owner keys, missing target fallback, or player-only shared owner decisions
  remain possible.

### STEP2-T06B: Review Owner Lookup Before Domain Validation

Contract ids: `COP-OWNER-001`, `COP-OWNER-002`, `COP-SHARED-001`.

Inputs:

- shared owner lookup decision table
- owner-key coverage report
- shared-owner write coverage report

Action:

- Confirm each shared or potentially shared command can derive exactly one owner
  key before domain execution, or has an explicit owner-resolution blocker.
- Confirm lookup failures are represented as owner-resolution blockers, not
  domain blockers.
- Confirm mission, battle, coordinate, encounter, territory, and route-local
  lookup paths do not silently fall back to player ownership.

Output:

- Owner lookup admission finding list.

Pass condition:

- Step3 owner resolver can implement shared owner lookup from documented inputs
  without entering domain handlers first.

Fail condition:

- Any contested territory or encounter command needs domain handler execution to
  discover its owner.

### STEP2-T07: Review Idempotency Coverage

Contract ids: `COP-IDEMP-001`, `COP-ENVELOPE-001`.

Inputs:

- Idempotency coverage report
- server fallback id classification report
- `CommandEnvelope` evidence

Action:

- Confirm every write helper and route is classified as `client-idempotent`,
  `server-fallback-id`, or `non-idempotent`.
- Confirm fallback ids cannot satisfy idempotency coverage.
- Confirm same-key different-payload handling is known or explicitly blocked.

Output:

- Idempotency admission findings.

Pass condition:

- Server-generated request, random, sequence, timestamp, or fallback ids are
  visible compatibility debt.

Fail condition:

- A field named `commandId` or `idempotencyKey` is accepted as compliance without
  stable client idempotency semantics.

### STEP2-T08: Review Route And Handler Debt Visibility

Contract ids: `COP-ROUTE-001`, `COP-HANDLER-001`, `COP-LOCK-001`.

Inputs:

- route orchestration report
- handler lock/persistence report
- server write-entry inventory

Action:

- Confirm route-owned load, validate, execute, save, retry, and project work
  remains visible until migration is real.
- Confirm handler-owned locks and persistence remain visible until retired.

Output:

- Route and handler debt verdict.

Pass condition:

- Helper wrappers and handler helper calls are still reported.

Fail condition:

- A helper named `pipeline`, `service`, `adapter`, or `runner` hides debt.

### STEP2-T09: Review Shared Target Coverage

Contract ids: `COP-SHARED-001`, `COP-OWNER-001`, `COP-LOCK-001`.

Inputs:

- shared-owner write coverage report
- owner-key coverage report
- territory, world encounter, world combat, and world march classifications

Action:

- Confirm territory and encounter shared-owner decisions are explicit.
- Confirm future loot and boss owner abstractions are represented.
- Confirm world march handoff points are not treated as player-only by default.

Output:

- Shared target admission findings.

Pass condition:

- Step3 can implement non-player owner locks without rediscovering target models.

Fail condition:

- Shared writes remain classified as private player writes by convenience.

### STEP2-T10: Review Anti-Evasion Coverage

Contract ids: `COP-ALLOWLIST-001`, `COP-CLIENT-001`, `COP-OWNER-002`,
`COP-IDEMP-001`, `COP-ROUTE-001`, `COP-HANDLER-001`.

Inputs:

- anti-evasion fixtures
- report test output
- allowlist debt records

Action:

- Confirm fake compliance patterns are covered by fixtures or assertions:
  renames, allowlist growth, fallback ids, payload-shape reclassification,
  helper wrappers, missing shared target fallback, and handler helper lock/save.

Output:

- Anti-evasion admission verdict.

Pass condition:

- Each fake pass listed by the admission spec has a failing fixture or explicit
  assertion.

Fail condition:

- A fake pass can satisfy Step1 reports without changing architecture.

### STEP2-T11: Produce P0/P1/P2 Findings

Contract ids: all affected `COP-*`.

Inputs:

- findings from STEP2-T02 through STEP2-T10, including STEP2-T04B and
  STEP2-T06B

Action:

- Classify findings:
  - P0: admission must fail; Step3 would build on false or missing evidence.
  - P1: admission can fail or require explicit waiver; Step3 risk is high.
  - P2: admission can proceed only if debt is tracked with owner and retirement
    condition.
- For each finding, record violated contract/spec section, consequence, debug
  difficulty, and target module.

Output:

- P0/P1/P2 admission findings.

Pass condition:

- No P0 remains.
- P1/P2 items have explicit owner, reason, retirement condition, and test.

Fail condition:

- Any finding lacks enough detail for Step1 correction or Step3 planning.

### STEP2-T12: Make Admission Decision

Contract ids: all `COP-*`.

Inputs:

- all admission findings
- admission criteria

Action:

- Decide `admitted`, `rejected`, or `rejected-with-required-Step1-revisions`.
- If rejected, list the exact Step1 tasks that must be revised.
- If admitted, list Step3 entry criteria that are satisfied and remaining tracked
  debts.

Output:

- Step2 admission decision record.

Pass condition:

- The decision clearly states whether Step3 may begin.

Fail condition:

- The decision relies on informal judgment instead of contract-linked evidence.

## 4. Step2 Completion Criteria

Step2 is complete only when:

1. The Step1 evidence package is frozen and reproducible.
2. Every `COP-*` has Step1 evidence or explicit blocker.
3. All admission questions are answered.
4. Frontend direct submit bypasses are admitted or rejected.
5. Shared owner lookup before domain validation is admitted or rejected.
6. Fake compliance risks are tested or rejected.
7. P0/P1/P2 findings are produced.
8. The decision record says whether Step3 may start.
9. If rejected, required Step1 corrections are listed as tasks.
10. If admitted, Step3 entry criteria are listed as satisfied.
