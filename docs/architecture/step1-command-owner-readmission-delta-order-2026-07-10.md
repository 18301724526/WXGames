# Step1 Re-admission Delta Order — Command Owner Pipeline

Status: **ACTIVE ORDER, 2026-07-10.** Scope = close 2 confirmed Step2-admission blockers in
Step1, then request re-admission. Do NOT start Step3. Do NOT touch resource-node.
Authority: owner-approved. Based on a Step2 admission review (5 dimensions, every FAIL
adversarially verified). Verdict: **REJECT — return to Step1.** All evidence below is
repo-verified with file:line by independent reviewers.

## Why rejected (both blockers are the same disease)

The Step1 scanner is genuinely a real source scanner (verified: real fs reads, bidirectional
drift). But two growth-guards have a **symmetric blind spot** that makes `inventory drift = 0`
a false "complete" signal — the exact cosmetic-compliance trap this gate exists to catch
(admission spec §1, §9.6). Close both on live data, not on fixtures.

---

## BLOCKER 1 — `getApi()` accessor receiver escapes the frontend direct-submit scanner

Two real, production-reachable write submits are neither scanned (52) nor inventoried (57),
so the completeness claim is false. Falsifies admission §4.2, §5 check #4, §9 criterion 8.

Evidence (verified):
- `frontend/js/platform/GameCommandService.js:143` — `await this.getApi().research(techId)`
- `frontend/js/platform/GameCommandService.js:173` — `await this.getApi().switchCity(cityId)`
- `getApi()` (`GameCommandService.js:41-46`) returns the raw GameAPI; `research`/`switchCity`
  are POST `/game/action` write helpers (already in `DEFAULT_WRITE_HELPER_NAMES`). These are
  `legacy-direct-gameapi` submits, identical to `build`/`upgrade` at
  `GameCommandService.js:127/128` in the SAME file which the inventory DOES classify.
- Reachable in prod: `CanvasGameApp.js:2841` `this.commandService.research(techId)` and
  `:2989 this.commandService.switchCity(cityId)`.

Root cause (real tooling blind spot, not data entry):
- `scanner.js` receiver pattern (~lines 420-429) enumerates
  `this.host.api|this.api|host.api|game.api|this.getGameApi()|getGameApi()|<aliases>` but NOT
  `getApi()`/`this.getApi()`.
- `discoverApiAliases` (~391-398) seeds `['api']` and only adds vars whose RHS matches
  `/\bapi\b|getGameApi/` — `this.getApi()` matches neither (`\bapi\b` fails on the capital-A
  `getApi`). The sibling `build`/`upgrade` are caught only incidentally because they were
  written `const api = this.getApi(); api.build()`; the inline `this.getApi().foo()` form slips.
- Symmetric blind spot: drift reconciliation is scanner-output vs scanner-GENERATED rows, so a
  hole in the scanner yields zero drift → false completeness.
- Anti-evasion is complicit: fixture `frontend-direct-submit-aliased-receiver`
  (`anti-evasion.js:41-46`) claims to prevent receiver renaming, but `classifyFixtureSample`
  (~92-101) reuses the same seed-`api`/getGameApi logic; `this.getApi().research(...)` → [] (not
  detected). No fixture covers the accessor-method receiver form. (The progress-doc line 122
  "receiver aliases … not literal receivers only" overstates coverage — correct it.)

Required fix:
1. Extend the scanner receiver coverage to catch the accessor-method form `getApi()` /
   `this.getApi()` (and make `discoverApiAliases` case-correct so it does not silently drop
   capital-A accessors). After the fix, the scanner must surface `GameCommandService.js:143`
   and `:173` as direct submits, and the inventory reconciliation must then include them (the 2
   rows should appear via the scanner-generated path, not hand-added — proving the scanner
   found them).
2. Add an anti-evasion fixture whose sample uses the accessor-method receiver
   (`this.getApi().research(...)`) so this evasion class has a growth-prevention guard; it must
   be DETECTED (non-empty) by `classifyFixtureSample`.
3. Fix the progress-doc overstatement about receiver-alias coverage.

Acceptance:
- `node scripts/report-command-owner-step1.js --json` shows the 2 sites represented; drift
  stays 0 ONLY because they are now genuinely covered on both sides.
- Adversarial self-check (do it and record it): temporarily add a third
  `this.getApi().<writeHelper>()` call in a scratch spot → scanner must emit a drift finding →
  revert. (Prove the fixed scanner is not itself a new echo.)
- New accessor-receiver fixture asserts detection in `report-command-owner-step1.test.js`.

---

## BLOCKER 2 — `allowlist-debt-record` check is inoperative on live data (echoes, never validates)

Admission spec §5 item 11 (lines 329-330) and Step1 spec §11.11 (lines 471-473) require the
`allowlist-debt-record` check to FAIL any allowlist/exclusion lacking the 5 required fields
(inventory id, owner, reason, retirement condition, growth-prevention test). The shipped check
does not validate — it only echoes. Defeats admission criterion §9.6 ("no compliance path
depends on broad allowlists").

Evidence (verified):
- `scripts/command-owner-step1/index.js:290-295` spreads `ALLOWLIST_DEBT_RECORDS` +
  `SERVER_WRITE_EXCLUSIONS` through `finding()` (`index.js:33-42`), which only echoes fields —
  no metadata validation.
- The real 5-field validator (`anti-evasion.js:3-9 REQUIRED_ALLOWLIST_FIELDS` + the object-shape
  branch ~84-88) is invoked ONLY by `runAntiEvasionFixtures` against the synthetic
  `allowlist-growth-missing-metadata` fixture — never against the live arrays.
- Verified by `--json`: the check emits 1 echoed finding (the fully-populated
  `player-register-disabled` exclusion) and the fixture reports `passed:true`; adding
  `{inventoryId:'x'}` to `ALLOWLIST_DEBT_RECORDS` would be echoed as a bland valid finding, not
  failed. A green fixture while the mechanism is disconnected from real data = exactly the fake
  metadata the gate rejects. (A clean-at-rest report is not evidence a FUTURE-facing growth
  guard works.)

Required fix:
- Run the `REQUIRED_ALLOWLIST_FIELDS` object-branch validation over the LIVE
  `ALLOWLIST_DEBT_RECORDS` + `SERVER_WRITE_EXCLUSIONS` arrays in the `index.js:290-295` branch,
  and emit an `allowlist-metadata-missing` finding for any entry missing a required field.

Acceptance:
- Adversarial self-check (do it and record it): temporarily add `{inventoryId:'x'}` to
  `ALLOWLIST_DEBT_RECORDS` → the check must emit `allowlist-metadata-missing` and the report must
  reflect it → revert.
- A test in `report-command-owner-step1.test.js` asserts the live-array validation fires on a
  synthetic under-specified entry (not just the isolated fixture).

---

## Also close while you are in there (non-blocking gaps the review surfaced)

These did NOT block admission but are cheap and were flagged; fold them in so re-admission is clean:
1. Record the two read-only POSTs `/api/admin/task-definitions/preview` (`adminRoutes.js:30`) and
   `/api/admin/config-releases/preview` (`:76`) as documented no-write exclusions in
   `SERVER_WRITE_EXCLUSIONS` with the same 5-field metadata as `player-register-disabled`
   (verified read-only; recording them prevents a future silent-persistence miss).
2. Stop flattening every direct-submit row to `controller-direct-submit`
   (`scanner.js:444`): distinguish the CanvasGameApp game-body/compatibility-tap sites and the
   GameCommandService service-bridge sites, per admission spec §4.2 / Step1 §7 debt classes.

Note (do NOT fix now, record only): admission dimension flagged that of the client local-block
signals, only `disabled` is source-traced; `can*/ready/busy/cooldown/eligible/claimable` exist
only as static `CLIENT_LOCAL_BLOCKS` rows. This is a larger scope item — leave a recorded TODO in
the progress doc for a future Step1 pass or Step3 Phase 1; it is not part of this delta.

---

## Non-negotiables

- Report-only throughout; no product behavior change; full `npm test` must stay green (2265+);
  `npm run lint` clean; LF line endings; `node scripts/run-architecture-smoke.js` exit 0.
- Per-blocker commits with focused tests green before the next.
- Do the two adversarial self-checks above and record their output in the progress doc — a green
  report is not proof; a guard must be shown to FIRE on a synthetic violation.
- Done = both blockers closed + acceptance self-checks recorded + progress doc updated + pushed
  to `private` and `origin`. Then the owner's review loop re-runs Step2 admission.
- If anything cannot be met, write an EXECUTION-BLOCKER-REPORT and stop — no narrow exceptions,
  no fixture-only "fixes", no hand-added inventory rows that bypass the scanner.
