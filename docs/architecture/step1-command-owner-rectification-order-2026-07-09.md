# Step1 Rectification Order — Command Owner Pipeline (owner-approved)

Status: **ACTIVE ORDER, 2026-07-09.** Scope = finish Step1 ONLY. Do not start Step2/Step3.
Authority: owner decision, based on an independent 15-agent feasibility review of the
command-owner document set (5 review seats, every blocker adversarially verified; all
evidence below is repo-verified with file:line).
Verdict being executed: the three-step plan is implementable; Step1 as currently staged
is a declaration table, not the scanner its own spec requires. Close that gap first.

## Review verdict summary (context)

- The current-state claims in the specs are accurate (debt list §13 verified line by
  line). The plan is sound. Step3's seven phases all target real modules.
- BUT Step2 admission cannot legitimately pass on today's Step1 output: the 12
  report-only checks echo hand-declared arrays and never read source; anti-evasion
  fixtures only test their own embedded samples. Inventory drift is invisible.

## Tasks (in order; each its own commit; all report-only — zero behavior change)

### T1 — Upgrade the 12 report-only checks from declaration-echo to real scanners
Evidence: `scripts/command-owner-step1/index.js:43-117` builds all findings purely from
`inventories.js` arrays; the module imports only `node:path`, zero fs reads.
Required:
- Checks must scan the repository (routes, `frontend/js/api/GameAPI.js`, dispatch/
  controller/handler surfaces) and RECONCILE scan results against the declared
  inventory. An undeclared new write route / GameAPI write helper / direct-submit call
  site must produce a finding; a declared entry that no longer exists must too
  (drift detection both directions).
- `client-disabled-command-path` must trace real producer→consumer flows (e.g.
  `WorldMapSiteOverlayRenderer.js:298` disabled hitTarget →
  `WorldMarchActionHandler.js:467` / `CanvasActionController.js:526` swallow).
- Anti-evasion direct-submit detection must survive receiver aliasing
  (`const svc = this.host.api; svc.claimConquest(...)` must still be caught —
  current regex at `anti-evasion.js:85` only matches literal receivers).
- Keep everything report-only. This is the bulk of Step1's real work; budget for it.

### T2 — Fix inventory data error (world-combat bypass mislabeled)
`inventories.js:278` assigns `routeEntry: 'server:game-action-registry'` to
`startWorldCombat`/`resolveWorldCombat`, while `inventories.js:49-64` correctly declares
`server:game-action-world-combat-bypass` ("bypasses registry"). This violates
STEP1-T03's own verification ("non-registry writes are not hidden under a generic
category"). Point both at the bypass entry.

### T3 — Add missing write entries (spec §4.1 "every" clauses)
- Ops persistence writes: `OpsControlService.js:64` (`fs.writeFileSync`, maintenance
  state via `POST /api/admin/ops/maintenance`, `opsRoutes.js:64`) and `:237` audit
  `appendFileSync` (ops restart/login). Add as server write entries with owner keys
  (suggest `ops:global`) and idempotency classification.
- The GameAPI diagnostic write helpers not currently inventoried (rescan all of
  `GameAPI.js` write-capable helpers as part of T1's reconciliation; declare every one).
- Note: `POST /api/player/register` verified as a 403 stub (no write) — record it as an
  explicit exclusion with reason instead of leaving it undocumented.

### T4 — Expand frontend direct-submit inventory to per-call-site rows (STEP1-T04B)
`FRONTEND_COMMAND_PATHS` currently has 6 aggregate rows; one row bundles
"CanvasActionController, CanvasGameApp, GameCommandService, controllers,
WorldMarchActionHandler". Real direct-submit call sites ≈ 34 across `CanvasGameApp.js`,
`GameCommandService.js` (note: lives in `frontend/js/platform/`, not `js/services/`),
`BuildingController.js`, `TerritoryController.js`, `WorldMarchActionHandler.js`, etc.
Each call site gets its own inventory row with migration target. T1's scanner should
generate/verify this list, not hand-maintenance.

### T5 — Fix owner-key-coverage check logic
`index.js:86-88` classifies by `provisionalOwnerKey.includes('{')` — every declared key
contains `{`, so `owner-resolution-blocker` can never fire, while
`SHARED_OWNER_LOOKUPS` separately declares `lookupBeforeDomainValidation=false` for
`startWorldCombat`/`resolveWorldCombat`/`startWorldMarch`. Make the two tables
cross-validate: a command whose shared lookup is not resolved before domain validation
must surface as an owner-resolution blocker (or carry an explicit, consistent
provisional marker in BOTH tables).

### T6 — Wire the report into architecture smoke + add tests (spec §12.9)
- `scripts/run-architecture-smoke.js` currently has zero `command-owner` references.
  Add the Step1 report as a report-only (non-blocking) smoke section, same pattern as
  `report-domain-business-candidates` (see its wiring at smoke lines ~367/595/798).
- Add `node --test` coverage: report runs and emits all 12 checks; drift detection
  fires on a synthetic undeclared-entry fixture; anti-evasion catches an aliased
  direct submit. (There are currently ZERO tests for the step1 tooling.)
- Repo gates: LF line endings, `npm run lint` clean before every push.

### T7 — Fix the §4.2 classification error in the Step1 spec
"Every existing GameActionRegistry action" heading covers 29 items, but the registry
registers 17 named + 9 territory actions = 26; `claimTaskReward` is a route
(`gameRoutes.js:513`), and the two world-combat actions are a route-level bypass
(`gameRoutes.js:15`). Keeping all 29 in the inventory is correct — fix the heading /
classification so the bypass stays visible, don't shrink the list.

### T8 — Amend the contract-test oracle with a second-writer clause
The §8 acceptance tests in `command-owner-pipeline-contract-test-spec-2026-07-09.md`
are single-process only, but march settlement has a worker writer. Decide and record:
either (a) owner locks must be cross-process (db-backed, e.g. better-sqlite3 table), or
(b) an explicit single-process deployment constraint is declared in the oracle.
This is an oracle amendment — record it as a visible decision (version bump + note),
not a silent edit.

## Non-negotiables

- Report-only throughout: no behavior change anywhere; full `npm test` must stay green
  (2260+); do not touch the frozen button-scheduler contracts.
- Per-task commits with focused tests green before the next task.
- Done = Step1 spec §12 acceptance criteria all true + update the staging progress doc
  with a completion section. If anything cannot be met, write a blocker report
  (EXECUTION-BLOCKER-REPORT pattern) and stop — no narrow exceptions, no renames,
  no wrapper dodges (spec §11 applies to the tooling itself too).
- Push to `private` and `origin` when done so the owner's review loop can verify.
