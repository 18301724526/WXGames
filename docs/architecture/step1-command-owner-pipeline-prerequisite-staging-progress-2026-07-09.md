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
