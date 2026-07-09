# Button Scheduler Manager Panel Slice 8b Retirement Receipt

Date: 2026-07-09
Worktree: `F:/AI Project/WXGamesLocal-button-scheduler-mainline`
Branch: `codex/button-scheduler-panel-mainline`
Pre-Slice commit: `18cfd6a0 test(panel): validate slice 8a equivalence`

## Retired Compatibility Paths

Slice 8b removed the first root-cause loop's famous panel compatibility debt:

- `CanvasActionController` no longer maps or implements the famous panel wrappers:
  `openFamousPersons`, `closeFamousPersons`, `openFamousPersonDetail`,
  `closeFamousPersonDetail`, and `changeFamousPersonsPage`.
- `CanvasPanelSurfaceManager.refreshPanelSurface(panelKey)` is removed.
- App/Shell no longer expose same-name famous panel wrapper methods.
- App/Shell no longer special-case famous panel actions through
  `renderPanelCanvasAction()` / `isPanelSurfaceAction()`.
- Async famous command failure/success refreshes use `projectModalLayer()` through the
  panel manager instead of the retired refresh alias.

The API command wrappers remain intentionally in `CanvasActionController`:

- `seekFamousPerson`
- `acceptFamousPerson`
- `dismissFamousPersonCandidate`
- `assignFamousAttributePoint`

Those are backend/API command routes, not panel action wrappers.

## Guard Test

Added `frontend/js/platform/CanvasPanelCompatibilityRetirement.test.js`.

It verifies:

- production JS has no retired wrapper/alias/base-repair symbols;
- App and Shell dispatch the full famous panel action sequence through dispatcher/runner;
- retired counters remain zero:
  - `panelAction.controllerWrapper.count`
  - `panelAction.dispatcherFallback.count`
  - `panelSurface.refreshAlias.count`
  - `panelSurface.syncAfterBaseRender.count`
  - `panelSurface.baseHitTargetsSnapshot.count`

## Verification

Slice 8b focused suite:

```powershell
$env:NODE_PATH='F:\AI Project\WXGamesLocal\node_modules'
node --test frontend/js/platform/CanvasPanelCompatibilityRetirement.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/CanvasGameRendererHitTargets.test.js frontend/js/platform/HitTargetManager.test.js frontend/js/platform/CanvasPanelSurfaceManager.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasGameAppTripleHostMirror.test.js frontend/js/platform/panels/CanvasPanelRegistry.test.js frontend/js/platform/panels/FamousPersonsPanel.test.js frontend/js/platform/CanvasStageScheduler.test.js frontend/js/platform/CanvasPanelActionContextAdapter.test.js frontend/js/platform/CanvasPanelActionRunner.test.js frontend/js/platform/CanvasPanelActionRegistry.test.js frontend/js/platform/CanvasActionDispatcher.test.js frontend/js/platform/CanvasActionControllerFamous.test.js
```

Result: 261 passed, 0 failed.

Lint and whitespace:

```powershell
& 'F:\AI Project\WXGamesLocal\node_modules\.bin\eslint.cmd' . --suppressions-location eslint-suppressions.json
git diff --check
```

Result: pass.

Production static retirement search:

```powershell
rg -n "refreshPanelSurface|syncOpenPanelSurfacesAfterBaseRender|baseHitTargetsByPanel|handle_openFamousPersons|handle_closeFamousPersons|handle_changeFamousPersonsPage|handle_openFamousPersonDetail|handle_closeFamousPersonDetail|controllerWrapper|renderPanelCanvasAction|isPanelSurfaceAction" frontend/js/platform -g "*.js" -g "!*.test.js"
```

Result: no production matches.

## Auxiliary Review Receipts

Task: Slice 8b compatibility retirement review
Model: Kimi Code
Slice: 8b
Input contract: owner execution plan Slice 8b retirement gates
Output type: independent review
Findings: APPROVE
Evidence: verified no production retired paths, dispatcher/runner is the single famous
panel route, and all five zero-counter gates are covered
Codex decision: accepted
Reason: cites static search, route structure, and retirement guard coverage.

Kimi session: `session_b5a6ecdb-757d-4fa7-bf85-c707c737572a`

Task: Slice 8b compatibility retirement review
Model: OpenCode `opencode-go/deepseek-v4-pro`
Slice: 8b
Input contract: owner execution plan Slice 8b retirement gates
Output type: independent review
Findings: APPROVE
Evidence: verified zero production references, single dispatcher route, zero-counter
coverage, and focused suite result
Codex decision: accepted
Reason: no frozen-contract blocker found.

## Slice 8b Decision

Slice 8b is green. The first root-cause loop is now at the minimum healthy stopping
point before wider panel migration. Proceed to Phase 5 full tests, merge to `main`, and
push `origin main` if full gates pass.
