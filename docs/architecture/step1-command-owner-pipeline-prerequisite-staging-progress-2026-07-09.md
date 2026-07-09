# Command Owner Pipeline Step1 Progress Handoff

Status: partial progress checkpoint
Date: 2026-07-09
Scope: Step1 prerequisite staging only

## Boundary

This checkpoint does not enter Step2 admission review and does not implement the
Step3 formal command owner pipeline.

No runtime command behavior was intentionally changed:

- no route migration
- no `ClientCommandSender`
- no real idempotency store
- no owner lock or shared owner lock implementation
- no frontend behavior change to force invalid clicks to the server
- no Step2 pass/fail admission decision
- no deployment and no push

## What Was Done

Started a split Step1 report-only implementation under
`scripts/command-owner-step1/`, with `scripts/report-command-owner-step1.js` as
the thin CLI entry point.

Current files:

- `scripts/report-command-owner-step1.js`
  - thin CLI/compatibility entry point
  - supports `--summary`, `--json`, and `--markdown`
- `scripts/command-owner-step1/contracts.js`
  - lists all current `COP-*` contract ids
  - defines the 12 required Step1 report-only checks
- `scripts/command-owner-step1/inventories.js`
  - starts the explicit Step1 inventory/classification data
  - covers server write entries, game actions, frontend write helpers, frontend command paths, local block classifications, route orchestration debt, handler lock/persistence debt, shared owner lookup decisions, shared owner write coverage, and allowlist records
- `scripts/command-owner-step1/anti-evasion.js`
  - adds initial anti-evasion fixtures for fake-pass patterns:
    - scanner rename/direct submit
    - allowlist missing metadata
    - server fallback id fake compliance
    - frontend direct submit bypass
    - domain blocker relabeled as `PAYLOAD_SHAPE`
    - helper-wrapper fake pipeline
    - missing shared target fallback to player owner
    - owner lookup after domain execution
    - handler helper lock/save
- `scripts/command-owner-step1/index.js`
  - builds the current report payload
  - wires inventory data into the 12 Step1 report names
  - runs anti-evasion fixture assertions

The current report maps all 17 known `COP-*` ids to Step1 report-only checks.

## Current Verification Snapshot

The following checks were run before this handoff:

```text
node --check scripts/report-command-owner-step1.js
node --check scripts/command-owner-step1/index.js
node --check scripts/command-owner-step1/anti-evasion.js
node scripts/report-command-owner-step1.js --summary
```

The current split implementation summary reports:

- `17/17` contract ids mapped
- `12` Step1 report-only checks
- `14` server write entries inventoried
- `29` game actions inventoried
- `30` frontend write helpers inventoried
- `6` frontend command paths inventoried
- `269` report-only findings
- `9` anti-evasion assertions

## What Is Not Done

This is not Step1-complete yet.

Remaining Step1 work:

- add focused unit tests for the split modules
- wire `scripts/report-command-owner-step1.js --summary` into `scripts/run-architecture-smoke.js`
- add `scripts/report-command-owner-step1.js` and the new test file to the architecture smoke file lists
- generate the final Step2 admission evidence package as a reviewable markdown artifact
- expand source-scanner assertions so the explicit inventory is checked against current files, not only declared
- verify all anti-evasion fixtures in node tests
- run the full relevant verification set
- decide whether to keep the current progress-checkpoint document or replace it with the final Step2 evidence package after Step1 completion

## Known Partial State

The inventory is explicit and reviewable, but it is not yet a fully admitted or
blocking gate. Findings are report-only by design.

`scripts/report-domain-business-candidates.js` was not changed. The new Step1
report has not yet been connected to architecture smoke in this checkpoint.

## Resume Point

Next recommended steps:

1. Run `node scripts/report-command-owner-step1.js --summary`.
2. Fix any split-module runtime issues.
3. Add `scripts/report-command-owner-step1.test.js`.
4. Wire the Step1 report into `scripts/run-architecture-smoke.js`.
5. Generate the final Step2 evidence package only after the report and tests run cleanly.

## Completion — Rectification Order T1-T8 (2026-07-09)

The rectification order `step1-command-owner-rectification-order-2026-07-09.md` (T1-T8)
is complete. Independently verified (adversarial, first-hand runs), not self-reported.

- **T1 real scanner** — `scripts/command-owner-step1/scanner.js` does real `fs`
  reads/traversal; `index.js` reconciles scanned vs declared with bidirectional drift
  findings (scanned-not-declared + declared-not-scanned). Adversarially confirmed:
  removing one `SERVER_WRITE_ENTRIES` line makes the scanner emit
  `inventory-drift-undeclared-server-write-route` for that route. Anti-evasion resolves
  receiver aliases (`const svc = ...api; svc.x()`), not literal receivers only.
- **T2** — world-combat writes classified under `server:game-action-world-combat-bypass`
  (`encounter:{encounterId}`, owner-resolution-blocked), no longer hidden under registry.
- **T3** — ops persistence writes (`admin:ops-login-audit` and ops maintenance/restart)
  inventoried; `/api/player/register` recorded as a documented no-write exclusion.
- **T4** — frontend direct-submit inventory expanded from 6 aggregate rows to per-call
  granularity (57 declared / 52 scanned), scanner-generated and drift-checked.
- **T5** — owner-key coverage cross-checks `SHARED_OWNER_LOOKUPS`; the three
  `lookupBeforeDomainValidation=false` commands surface as owner-resolution blockers
  (17 blocker findings total).
- **T6** — `scripts/report-command-owner-step1.js --summary` wired into
  `scripts/run-architecture-smoke.js` as a report-only guard; `report-command-owner-step1.test.js`
  asserts scanning behavior (all 12 checks emit, synthetic drift fires, aliased receiver
  caught) — 4/4 pass.
- **T7** — step1 spec §4.2 heading/classification corrected; the 29-item list is kept
  (write-command set), with claimTaskReward and the two world-combat bypasses annotated
  as non-registry.
- **T8** — contract-test oracle bumped v0.5 → v0.6 with §4.4.1 second-writer clause
  (march worker as a second write process); owner ratification required between
  cross-process locks (recommended) and a single-process constraint.

### Pre-existing blocker resolved (out of command-owner scope)

The architecture smoke was red on main before this work, from docs sweep `985c1111`
deleting a broad set of docs while leaving consumers. Resolved under owner direction:
retired two fully-orphaned docs-governance guards (`check-stable-blocks`,
`verify-refactor-plan-doc`) whose data was intentionally swept; restored four live-guard
baseline docs collaterally deleted (3 frontend ECS spine baselines + 1 config-pipeline
snapshot). Architecture smoke now exits 0.

### Final gate state

- `node scripts/run-architecture-smoke.js`: exit 0.
- `node --test scripts/report-command-owner-step1.test.js`: 4/4 pass.
- Step1 report: 17/17 contracts, 12 checks, inventory drift 0, anti-evasion 10.
- Step1 is ready for Step2 admission review.
