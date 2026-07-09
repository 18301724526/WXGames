# Button Scheduler Manager Panel Slice 8a Equivalence Receipt

Date: 2026-07-09
Worktree: `F:/AI Project/WXGamesLocal-button-scheduler-mainline`
Branch: `codex/button-scheduler-panel-mainline`
Pre-Slice commit: `d9b09fc2 feat(panel): isolate hit targets into named pools`

## Scope

Slice 8a validated the integrated famous panel route before compatibility retirement.
The validation compared the refactored route against the Slice 0 true-base baseline for:

- action and tutorial callback order;
- modal dirty/flush behavior;
- async famous command reopen behavior;
- hit target pools and outside-click behavior;
- App, Shell, and mini-game dispatcher-first routing;
- compatibility counter readiness.

## Contract Fix Found During 8a

The owner execution plan supersedes the refactor spec and requires silent reopen bypass
flags to be trusted runner options, not action fields. The implementation now exposes:

```js
runner.run(action, context, options = {})
```

`bypassOpenVeto` and `suppressAfterHooks` are read only from `options`. Action-carried
`bypassPanelOpenVeto` and `suppressAfterHooks` are ignored, so renderer-emitted actions
cannot carry bypass authority.

Normal open/close/action flow remains:

```text
beforeOpen -> executeDescriptor -> flushDirty -> afterOpen/afterClose/afterAction
```

When trusted `suppressAfterHooks` is set, it returns only after execute and flush.

## Verification

Focused runner check:

```powershell
node --check frontend/js/platform/CanvasPanelActionRunner.js
$env:NODE_PATH='F:\AI Project\WXGamesLocal\node_modules'
node --test frontend/js/platform/CanvasPanelActionRunner.test.js
```

Result: 6 passed, 0 failed.

Slice 8a extended equivalence suite:

```powershell
$env:NODE_PATH='F:\AI Project\WXGamesLocal\node_modules'
node --test frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/CanvasGameRendererHitTargets.test.js frontend/js/platform/HitTargetManager.test.js frontend/js/platform/CanvasPanelSurfaceManager.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasGameAppTripleHostMirror.test.js frontend/js/platform/panels/CanvasPanelRegistry.test.js frontend/js/platform/panels/FamousPersonsPanel.test.js frontend/js/platform/CanvasStageScheduler.test.js frontend/js/platform/CanvasPanelActionContextAdapter.test.js frontend/js/platform/CanvasPanelActionRunner.test.js frontend/js/platform/CanvasPanelActionRegistry.test.js frontend/js/platform/CanvasActionDispatcher.test.js frontend/js/platform/CanvasActionControllerFamous.test.js
```

Result: 259 passed, 0 failed.

Lint and whitespace:

```powershell
& 'F:\AI Project\WXGamesLocal\node_modules\.bin\eslint.cmd' . --suppressions-location eslint-suppressions.json
git diff --check
```

Result: pass.

## Static Search Results

- `bypassPanelOpenVeto`: no production match.
- `action.suppressAfterHooks` / `action.bypass*`: no production match.
- `suppressAfterHooks` / `bypassOpenVeto`: only `CanvasPanelActionRunner.js` production
  support plus tests.
- `baseHitTargetsByPanel`: no production match.
- `syncOpenPanelSurfacesAfterBaseRender`: no production method; only tests/stubs remain.
- `CanvasActionController` famous wrappers: still present, counted, and scheduled for
  Slice 8b retirement.
- `refreshPanelSurface(panelKey)`: still present as a counted alias with production
  callers in App/Shell, scheduled for Slice 8b retirement.
- dispatcher fallback counters: still present for unsupported actions; descriptor-backed
  famous action tests route through dispatcher/runner first.

## Auxiliary Review Receipts

Task: trusted-options runner fix and Slice 8a equivalence review
Model: Kimi Code
Slice: 8a
Input contract: owner execution plan mandatory silent-reopen fix; Section 8 equivalence
Output type: independent review
Findings: APPROVE
Evidence: verified options-only bypass, normal hook order, and no renderer/action bypass
Codex decision: accepted
Reason: cites the owner execution plan and matching tests; no blocker.

Kimi session: `session_4eb2e81b-6887-4691-bccb-dcedd72ae853`

Task: trusted-options runner fix and Slice 8a equivalence review
Model: OpenCode `opencode-go/deepseek-v4-pro`
Slice: 8a
Input contract: owner execution plan mandatory silent-reopen fix; Section 8 equivalence
Output type: independent review
Findings: APPROVE
Evidence: verified options-only bypass, preserved hook order, no renderer smuggling path,
and all stated verification gates passing
Codex decision: accepted
Reason: cites static search and focused tests; no blocker.

## Slice 8a Decision

Slice 8a is green. The branch may proceed to Slice 8b compatibility retirement.

Remaining Slice 8b retirement targets:

- `CanvasActionController` famous wrappers;
- public `refreshPanelSurface(panelKey)` callers outside manager/scheduler tests;
- App/Shell hardcoded famous panel surface refresh branches;
- any remaining compatibility counter path that is no longer reachable for descriptor-backed
  famous actions.
