# Step3 Phase 1 Client Command Semantics Verification

Status: **COMPLETE, 2026-07-10.** Scope is STEP3-T01 + STEP3-T02 only.

## Commits

- `1fd860d5` — STEP3-T01: split visual disabled state from command-submit state.
- STEP3-T02 final commit — restrict and log local command-submit block reasons.

## Frozen Button Scheduler Contract

- `CanvasPanelActionRunner.js` and `CanvasPanelActionRunner.test.js` were not changed.
- The existing disabled short-circuit and hook-order tests remain green.
- No retired compatibility path or repair layer was reintroduced.

## Real UI Before / After

Method: headless Playwright against a temporary full static + API verification server. The
in-app browser was not opened. Both versions used the same 430x932 viewport, the same fixture
state (`eraProgress.canAdvance = false`), the same rendered Canvas controls, and a structured
domain rejection response.

### Before — `fbefd4e7`

- Rendered action: `{ type: "advanceEra", disabled: true }`.
- Clicked the real Canvas hit target after opening the civilization panel.
- `POST /api/game/action` count after click: **0**.
- Result: silent client-side swallow.

### After — current Phase 1

- Rendered action: `{ type: "advanceEra", visualDisabled: true }`.
- The button remained visually disabled and retained its real Canvas hit target.
- Clicked the same real Canvas control.
- `POST /api/game/action` count after click: **1**.
- Request body: `{ "action": "advanceEra" }`.
- Response: HTTP **400**, `{ success: false, error: "INSUFFICIENT_RESOURCES", message: "资源不足，无法进入下一时代" }`.
- No page exception or crash occurred; the rejection stayed in the normal API failure path.

Temporary evidence was written outside the repository to:
`%TEMP%/wxgames-step3-real-flow/result.json`, `before.png`, and `after.png`.

## Server Preconditions

- `AdvanceEraAction.execute()` returns structured domain results such as
  `INSUFFICIENT_RESOURCES`, `CITY_CANNOT_ADVANCE`, and `ERA_MAX_REACHED`.
- `/api/game/action` maps unsuccessful action results to HTTP 400 rather than 500.
- `GameRoutesTutorial.test.js` covers the ineligible advance-era route response directly.

## Quality Gates

- Full `npm test`: 2274/2274 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: passed; Step1 inventory drift findings = 0.
- Client command block guard: passed.
- LF/diff checks: passed.
