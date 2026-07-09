# Step3 Phase 1 Client Command Semantics Verification

Status: **RE-ADMISSION DELTA COMPLETE, 2026-07-10.** Scope remains STEP3-T01 + STEP3-T02
plus owner-approved D1-D5 only. Phase 2 was not started and `resource-node` was not touched.

## Commits

- `1fd860d5` - STEP3-T01: split visual disabled state from command-submit state.
- `3e990e33` - STEP3-T02: restrict and log local command-submit block reasons.
- `6154d4a3` - D2: restore `visualDisabled` button rendering.
- `bb48e6af` - D1: allow empty-formation world march submission.
- `f745c09b` - D3: make tutorial state display-only for command submission.
- `a06722aa` - D4: strengthen and wire the client command-block guard.
- `b5a649b4` - D5: converge tutorial readers and remaining command producers.
- `7dbbee09` - D1 live-flow follow-up: forward world march through the mounted game object.
- `f9506366` - D2 live-flow follow-up: surface territory domain rejection without `pageerror`.
- `cb2a0a42` - synchronize existing Step1 command inventory call-site line numbers.

## D1-D5 Closure

- D1: `WorldMarchActionHandler` no longer treats deployment eligibility as a terminal client
  rejection. Empty formations reach `GameAPI.startWorldMarch`; the server rejection is shown.
- D2: `CanvasSurfaceRenderer.drawButton` consumes `visualDisabled` as a disabled-style hint.
  The world-site launch button remains grey, keeps its hit target, submits, and handles HTTP 400.
- D3: compliance option (a) was implemented. Tutorial state may still constrain non-command
  input routing, but it no longer swallows command submissions in `CanvasGameShell` or
  `GameCommandService`. No deviation record is required.
- D4: the guard now parses dispatch paths with `espree`, catches domain-conditioned early
  returns and command-to-modal conditional replacement, checks `commandDisabled` reasons,
  and runs as a blocking architecture-smoke gate with synthetic-violation tests.
- D5: tutorial target readers use `isVisuallyDisabled(action)`, visually disabled commands are
  excluded from guide targets, and remaining command producers use `visualDisabled`.

## Frozen Button Scheduler Contract

- `CanvasPanelActionRunner.js` blob stayed `c45d1ab4eb245337b22b1555a027a147ae8b5a80`.
- `CanvasPanelActionRunner.test.js` blob stayed `c6f92374db9189e5d48792365c48ad1d7669a36e`.
- Direct frozen test run: 6/6 passed, including disabled short-circuit and hook behavior.
- No retired compatibility path or repair layer was reintroduced.

## Real UI Before / After

Method: headless Playwright against a temporary full static + API verification server. The
in-app browser was not opened. The after run used a 430x932 viewport and clicked real Canvas
hit targets.

### D1 - Empty Formation March

Before at the failed Phase 1 review head:

- `getWorldMarchDeploymentEligibility().blocked` opened a terminal modal.
- The only modal action closed the dialog; `POST /api/game/action` count remained **0**.

After D1:

- Rendered action retained `visualDisabled: true` and `FORMATION_EMPTY` eligibility evidence.
- Clicking the real Canvas target submitted exactly **1** `startWorldMarch` request.
- Response: HTTP **400**, `error: FORMATION_EMPTY`, message `编队为空，无法出征`.
- Promise path resolved to `false`; `pageErrors` remained empty.

### D2 - Domain-Ineligible World-Site Button

Before at the failed Phase 1 review head:

- `visualDisabled` was passed into the draw chain but had no consumer.
- The launch button lost its greyed visual state.

After D2:

- Action: `{ type: "launchExpedition", territoryId: "site-1", visualDisabled: true }`.
- Grey launch-button pixel: `[46, 41, 36, 255]`; adjacent enabled control pixel:
  `[47, 33, 21, 255]`.
- Clicking the real grey Canvas target submitted exactly **1** `startConquest` request.
- Response: HTTP **400**, `error: INSUFFICIENT_SOLDIERS`, message `士兵不足，无法发起远征`.
- The rejection was surfaced through the territory controller; `pageErrors` remained empty.

### D4 - Adversarial Guard Self-Check

Temporary synthetic violation injected into `CanvasActionDispatcher.handle`:

```js
if (normalizedAction?.eraLocked) return true;
```

Guard result:

```text
EXIT_CODE=1
frontend/js/platform/CanvasActionDispatcher.js:53 domain-conditioned early return in handle
```

The injection was then removed. The file hash returned to
`8fe3b8349d3ec7db41038c0e184dd2d6767414e5`, and the guard printed
`client command block reason guard passed`.

Temporary UI evidence was written outside the repository to:
`%TEMP%/wxgames-step3-readmission-flow/result.json`,
`empty-formation-before-click.png`, and `site-disabled-before-click.png`.

## Quality Gates

- Full `npm test`: 2282/2282 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0.
- Step1 command inventory drift findings: 0.
- Client command block guard: passed after synthetic violation removal.
- Frozen button-scheduler test: 6/6 passed; frozen blobs are identical.
- `resource-node` diff: none.
- Source encoding, LF, and `git diff --check`: passed.
