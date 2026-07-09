# Step3 Phase 1 Order — Client Command Semantics Split

Status: **ACTIVE ORDER, 2026-07-10.** Step2 admission PASSED (both blockers verified closed,
adversarially). Step3 is unlocked. Scope = **Step3 Phase 1 ONLY** (STEP3-T01 + STEP3-T02).
Do NOT start Phase 2. Do NOT touch resource-node.
Authority: owner-approved, phase-by-phase dispatch — each phase re-reviewed before the next.
Spec of record: `step3-command-owner-pipeline-implementation-spec-2026-07-09.md` §4 Phase 1 +
`step3-command-owner-pipeline-implementation-tasks-2026-07-09.md` §4 (STEP3-T01, STEP3-T02).
Contract oracle: `command-owner-pipeline-contract-test-spec-2026-07-09.md`
(`COP-CLIENT-001/002`, `COP-AUTHORITY-001`, `COP-TIME-001`).

## This is the first product-behavior phase — read before touching code

Steps 1 was report-only tooling. Phase 1 CHANGES USER-VISIBLE BEHAVIOR: a control that is
domain-ineligible today is swallowed client-side; after Phase 1 the click still emits the
command intent to the server, which returns a clean domain rejection. That is the point
(`COP-AUTHORITY-001`: the server, not client display state, is the command authority). It is
also the risk. Treat behavior-equivalence and real-flow verification as mandatory, not optional.

## Goal (Phase 1 only)

1. Introduce a local distinction between `visualDisabled` (keep the greyed/hint look) and
   `commandDisabled` (actually block submission). Domain display eligibility becomes
   `visualDisabled` only — it must NOT block the command-submit path.
2. Permit ONLY these local command-submit block reasons: `IN_FLIGHT`, `DUPLICATE_COMMAND_ID`,
   `PAYLOAD_SHAPE`, `UI_NOT_READY`. Everything else (resources, tutorial, era, tech, cooldown,
   march, candidate, territory, reward, encounter, loot, boss eligibility) is display-only.
3. Record every local command-submit block in `ClientOperationLog` with command type, command
   key, and reason.

## Known disabled-swallow sites to convert (verified in prior reviews — start here, do not assume these are all)

- `CanvasActionDispatcher.js:40` — `if (action.disabled) return true` (early swallow)
- `CanvasPanelActionRunner.js` (~162) — disabled short-circuit
- `CanvasActionController.js` (~526, and ~809/820)
- `CanvasGameShell.js` (~1358)
- `CanvasGameApp.js:2814` — `canAdvanceEraNow` hard gate
- `WorldMarchActionHandler.js` (~467) — `if (action?.disabled) return true`
- command-capable renderers/presenters that currently EMIT `disabled` (the producers) — the
  admission review noted only `disabled` is source-traced today; the sibling signals
  `can* / ready / busy / cooldown / eligible / claimable` (from the Step1 deferred TODO) are the
  domain-eligibility producers that must become `visualDisabled`, not submit-blocks. Enumerate
  them from source; do not hand-wave "these are all of them."

## HARD constraint — do not break the frozen button-scheduler contracts

The `disabled` short-circuit in `CanvasActionDispatcher` / `CanvasPanelActionRunner` was frozen
by the just-landed button-scheduler refactor (Slice 0-8b, `CanvasPanelActionRunner.test.js`
order-lock, retirement guard). Splitting visual/command disabled MUST NOT regress panel behavior:
- The panel action runner's `disabled` handling and hook-order must stay test-green.
- Do not reintroduce any retired compatibility path or repair layer.
- If a needed change touches a frozen contract, STOP and write a blocker report — do not quietly
  edit the frozen test to pass.

## Server-side precondition to verify (not to build in Phase 1)

Because commands now reach the server that the client used to block, confirm (read + a driven
check) that the affected server handlers return a clean domain rejection (e.g. 4xx / structured
error), NOT a 500, for the previously-client-blocked cases (advance-era-when-ineligible,
research-when-locked, etc.). If any returns 500 / crashes, record it as a Phase-1 finding; the
server hardening itself is later-phase work, but Phase 1 must not ship a UI that turns a greyed
button into a server crash.

## Verification (mandatory — this phase changes behavior)

- STEP3-T01: tests prove domain-disabled state stays VISIBLE while the server command path is NOT
  suppressed.
- STEP3-T02: tests FAIL if any domain signal (resources/tutorial/era/tech/cooldown/march/
  candidate/territory/reward/encounter/loot/boss) appears as a command-submit block.
- Behavior-equivalence: for each converted site, a test asserting the visual (greyed) state is
  unchanged and only the submit-gating changed.
- Drive the real flow (use the /verify or /run skill): click a domain-ineligible control (e.g.
  advance-era while ineligible) and confirm it now emits the command and surfaces a clean
  rejection, not a crash or a silent no-op. Record the observed before/after.
- The Step1 report-only guards must stay green (the frontend direct-submit inventory now includes
  the GameCommandService getApi sites; do not regress that).

## Non-negotiables

- Scope = Phase 1 only (STEP3-T01, STEP3-T02). Do NOT begin Phase 2 (universal ClientCommandSender).
- Per-task commits (T01, T02 separately); focused tests green before the next.
- Full `npm test` green (2265+), `npm run lint` clean, LF line endings,
  `node scripts/run-architecture-smoke.js` exit 0.
- No frozen-contract edits to force a pass; no domain-eligibility left as a submit-block; no new
  local block reason outside the four allowed.
- Done = STEP3-T01 + STEP3-T02 complete, verification recorded (including the driven real-flow
  observation), pushed to `private` and `origin`. Then the owner's review loop re-reviews Phase 1
  before Phase 2 is dispatched.
- If any of this cannot be met, write an EXECUTION-BLOCKER-REPORT and stop — no narrow exceptions.
