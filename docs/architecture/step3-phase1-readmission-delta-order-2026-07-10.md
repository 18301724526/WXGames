# Step3 Phase 1 Re-admission Delta Order

Status: **ACTIVE ORDER, 2026-07-10.** Phase 1 review verdict: **FAIL — return for delta.**
Scope = close the 5 confirmed defect roots below, then request Phase 1 re-review.
Do NOT start Phase 2. Do NOT touch resource-node.
Authority: owner-approved. Based on a 22-agent review (5 dimensions, 17 FAIL claims,
each adversarially verified: **7 confirmed / 10 refuted**). All evidence repo-verified.

## What passed (do not redo, do not regress)

The trunk is real, not cosmetic: `ClientCommandSemantics.normalizeAction` at the
hit-target registration point + 5 consumption points genuinely strips `disabled` for
command types; `canAdvanceEraNow` hard gate deleted with a real behavior test; the
`commandDisabled` whitelist fail-opens domain reasons to the server (verified by live
node runs); frozen button-scheduler files are blob-identical across both commits with
20/20 frozen tests green; server domain rejections are clean (no 500s); IN_FLIGHT
dedup verified wired. The failures below are completeness and consumer-side
integration — finish the job.

---

## D1 — March domain gate still blocks submission (in the module the order NAMED)

`WorldMarchActionHandler.js:469-472` (2 lines below the `:467` disabled early-return you
deleted): `getWorldMarchDeploymentEligibility().blocked` → `showWorldMarchDeploymentBlocked`
modal (its only action = closeConfirmDialog) → **startWorldMarch never reaches the
server**. The blockers `FORMATION_EMPTY` / `FORMATION_PRIMARY_NO_SOLDIERS`
(`shared/formationDeploymentEligibility.js:144-150`) are formation-domain state — not
payload shape, not one of the four allowed reasons, and no `command:localBlock` log.
Contrast: the deputy-warning path in the same handler correctly allows proceeding via
`skipDeploymentWarnings`.

Fix: the march eligibility result becomes display/confirm-flow only — the command must
be submittable (server is the authority; it already validates formations). If a
confirm-dialog UX is kept, its confirm path must SUBMIT (like the deputy-warning path),
not dead-end. Add a behavior test: empty-formation startWorldMarch reaches the API and
surfaces the server rejection.

## D2 — Greyed look LOST on world-site overlay buttons (dead visualDisabled)

You renamed drawButton's option `disabled`→`visualDisabled` at
`WorldMapSiteOverlayRenderer.js:293` and `:357`, but the entire draw chain
(`WorldMapSiteOverlayRenderer.js:99-100` → `WorldMapCanvasRenderer.js:417-418` →
`CanvasGameRenderer.js:1264-1268` → `CanvasSurfaceRenderer.drawButton:387-404`) branches
ONLY on `options.disabled`/`options.active`. `visualDisabled` has **zero consumers in any
draw path** (project-wide grep). Result: domain-ineligible site buttons (e.g. expedition
launch without enough soldiers) render NOT grey — spec goal "keep the greyed/hint look"
is violated; user loses the visual cue entirely.

Fix: make the draw chain consume the visual hint (either drawButton accepts
`visualDisabled` as the greyed-style trigger, or map it back to the style option at the
draw boundary). Add a render test asserting a `visualDisabled` command button draws with
the disabled style. Sweep ALL drawButton call sites converted in 1fd860d5 for the same
dead-option issue.

## D3 — Tutorial gates still swallow submission, with no recorded exemption

1. `CanvasGameShell.js:1327` tutorial input shield: while a guide highlight/intro is
   active it swallows every non-guide command action (logs `input:tutorialBlocked` —
   not `command:localBlock`, not one of the four reasons). Commit 1fd860d5 touched this
   exact line (action→normalizedAction) and kept the interception.
2. `GameCommandService.js:108-112` tutorial gate swallows buildBuilding/upgradeBuilding
   before the API call.

Spec §4 Phase 1, the order's non-negotiables, and COP-CLIENT-001 all list `tutorial` as
display-only. No exemption or blocker record exists anywhere.

Fix — one of two, explicitly:
- (a) Convert: tutorial state becomes display-only for command submission (guide UX may
  still highlight/hint, server rejects what must be rejected); or
- (b) If you believe the tutorial input shield is modal input-routing rather than domain
  eligibility (defensible for the shield, weaker for the GameCommandService gate), STOP
  and write a formal deviation record (what is exempted, why, retirement condition) for
  owner ratification — do not leave it as silent noncompliance. The GameCommandService
  gate at minimum must comply or be explicitly deferred with a record tying it to Phase 2
  (its module is a Phase 2 target).

## D4 — New guard is single-channel and toothless (third occurrence of this pattern)

`scripts/check-client-command-block-reasons.js:23` hard-skips any line without the
literal `commandDisabled` — verified: files containing `if (eligibility.blocked) return
true` (the exact D1 pattern) pass exit 0. Also: the guard is wired into NO gate (absent
from `run-architecture-smoke.js`; its `.test.js` lives in `scripts/` which `npm test`
does not scan), and its test has no synthetic-violation FIRE case.

Fix:
- Broaden detection beyond the `commandDisabled` channel: it must catch handler-level
  domain swallows on the command dispatch/submit paths (at minimum the two bypass
  patterns the review proved it misses: eligibility-blocked early return; domain-
  conditioned action-type ternary). A pragmatic structural approach (e.g. chokepoint
  swallow-count baseline on the dispatch files) is acceptable if content matching is
  too brittle — but it must FIRE on a synthetic `if (action.eraLocked) return true`
  added to a dispatch path.
- Wire it into `run-architecture-smoke.js` (blocking) and add its test to the smoke
  TEST_FILES list.
- Adversarial self-check (record output in the verification doc): inject the synthetic
  violation → guard exits 1 → revert. A guard that has never fired is not a guard.

## D5 — Tutorial readers still read the stripped field; producers not converged

`normalizeAction` deletes `disabled` from every pooled command action, so ~30
`!action.disabled` guide predicates (`TutorialGuideFlowRegistry.js:113/130/309/820…`,
`TutorialGuideController.js:571/627/815`, `TutorialGuideTargetResolver.js:186`, tutorial
shield matcher) are now constant-true for all 28 command types — verified by live node
run: a grey `claimTaskReward` now matches the shield/predicates where baseline
`fbefd4e7` returned false. Consequence: the guide can pin highlights on domain-grey
buttons and activate the input shield around a button whose click will be server-
rejected (plausible tutorial soft-lock; predicate flip is CONFIRMED). Also
`FamousPersonPresenter.js:414` (and sweep for siblings) still produces bare
`disabled: !seekAvailable`.

Fix: migrate tutorial predicates/shield matchers to the new vocabulary (read
`visualDisabled`, e.g. via a shared `isVisuallyDisabled(action)` helper in
`ClientCommandSemantics`), converge remaining bare-`disabled` producers to
`visualDisabled`, and add a regression test: a `visualDisabled` command action must NOT
be selectable as a guide highlight target.

---

## Non-negotiables (unchanged + additions)

- Scope = D1-D5 only. No Phase 2. Frozen button-scheduler contracts stay untouched and
  their tests stay green (they were verified blob-identical — keep it that way).
- Per-defect commits; focused tests green before the next; full `npm test` green,
  `npm run lint` clean, LF, `run-architecture-smoke.js` exit 0.
- Re-drive the real flows and record before/after in the verification doc:
  ① empty-formation startWorldMarch → submits → clean server rejection;
  ② domain-ineligible site button → still greyed AND submits on click;
  ③ synthetic guard violation → guard FIREs (then reverted).
- D3 requires either compliance or a written deviation record for owner ratification —
  silent noncompliance is the one thing that gets an order rejected outright.
- Done = D1-D5 closed + verification doc updated + pushed to `private` and `origin`.
  Then the owner's review loop re-reviews Phase 1. Anything unachievable → 
  EXECUTION-BLOCKER-REPORT and stop.
