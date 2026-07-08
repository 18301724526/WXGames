# Button Scheduler Manager Panel Slice 0 Baseline

Date: 2026-07-09
Worktree: `F:/AI Project/WXGamesLocal-button-scheduler-mainline`
Branch: `codex/button-scheduler-panel-mainline`
Base commit: `3bc2aa9b2d766c25b4d2303b2d416efe2762377d`

This is the TRUE-base Slice 0 baseline after `main` was unified with `codex/pvpve-systems`
and `codex/battle-core-test-server`. It replaces the old wrong-base baseline from
`F:/AI Project/WXGamesLocal-button-scheduler-root-cause`.

## Focus Command

The mainline worktree intentionally reuses the root checkout's installed dependencies.
Run focused tests with `NODE_PATH` pointed at the root `node_modules`:

```powershell
$env:NODE_PATH='F:\AI Project\WXGamesLocal\node_modules'
node --test `
  frontend/js/platform/CanvasActionDispatcher.test.js `
  frontend/js/platform/CanvasActionControllerFamous.test.js `
  frontend/js/platform/CanvasPanelSurfaceManager.test.js `
  frontend/js/platform/panels/FamousPersonsPanel.test.js `
  frontend/js/platform/CanvasGameApp.test.js `
  frontend/js/platform/CanvasGameShell.test.js
```

Result on Slice 0 v2: 149 passed, 0 failed.

Without `NODE_PATH`, the sibling worktree cannot resolve `bitecs`; `EcsModeRuntime` is
unavailable, `CanvasModalSnapshotAdapter` fails closed, and the focus command reports
false negatives. That is an environment precondition, not a product behavior baseline.

## True-Base Implementation Facts

- `CanvasPanelSurfaceManager.js` exists and owns `openPanel`, `closePanel`,
  `runPanelAction`, `refreshPanelSurface`, and `clearPanelSurface`.
- `CanvasPanelSurfaceManager` still has the compatibility fields
  `baseHitTargetsByPanel` and `syncOpenPanelSurfacesAfterBaseRender()`.
- `panels/CanvasPanelRegistry.js` exists with a single registered panel:
  `famousPersons -> FamousPersonsPanel`.
- `panels/FamousPersonsPanel.js` owns the current famous panel lifecycle:
  open, close, change page, open detail, close detail, tooltip clearing, and render.
- `CanvasActionController` still has wrapper methods for famous panel actions.
- `CanvasGameApp.renderPanelCanvasAction()` treats `openFamousPersons`,
  `closeFamousPersons`, `openFamousPersonDetail`, `closeFamousPersonDetail`, and
  `changeFamousPersonsPage` as panel-surface actions and calls
  `refreshPanelSurface('famousPersons', { action })`.
- App async commands call the game API, apply API state with `{ render:false }`, then
  use the panel manager to reopen or refresh the famous panel.

## Behavior Locks

### Tutorial Veto

Action: `openFamousPersons` while `tutorialController.canOpenTab('famousPersons')`
returns false.

Trace:

1. `canOpenTab('famousPersons')`
2. `showFloatingText(guide.completeCurrentStep)`
3. return handled `false`

Locked effects:

- no `showFamousPersons` modal opens;
- no `modal:famousPersons` opens;
- sibling blocking panels remain open;
- `famousPersonsPage` and `selectedFamousPersonId` are not mutated;
- no tooltip clear;
- no render;
- no `onFamousPersonsOpened`;
- no highlight refresh or next-tick refresh.

### Famous Open

Action: allowed `openFamousPersons`.

Trace with tutorial gate present:

1. `canOpenTab('famousPersons')`
2. `FamousPersonsPanel.open()`
3. `openBlockingPanelSnapshot('showFamousPersons', true)`
4. mounted game owner resets `famousPersonsPage = 0`
5. mounted game owner resets `selectedFamousPersonId = ''`
6. competing blocking panels close except `showFamousPersons`
7. event snapshot closes
8. renderer clears famous skill tooltip
9. controller `afterHandled()` calls `renderCanvasAction(openFamousPersons)`
10. `renderPanelCanvasAction()` calls `refreshPanelSurface('famousPersons', { action })`
11. `tutorialController.onFamousPersonsOpened()`
12. `tutorialController.refreshCurrentHighlight()`
13. `setTimeout(..., 0)`
14. `tutorialController.refreshCurrentHighlight()`
15. return handled `true`

Owner split lock: shell-local stale fields are not reset when a mounted game is the UI
state owner. The mounted game owner is reset.

### Famous Close

Action: `closeFamousPersons`.

Trace:

1. `FamousPersonsPanel.close()`
2. `closeBlockingPanelSnapshot('showFamousPersons')`
3. mounted game owner resets `famousPersonsPage = 0`
4. mounted game owner resets `selectedFamousPersonId = ''`
5. renderer clears famous skill tooltip
6. controller `afterHandled()` calls `renderCanvasAction(closeFamousPersons)`
7. `renderPanelCanvasAction()` calls `refreshPanelSurface('famousPersons', { action })`
8. `tutorialController.onFamousPersonsClosed()` when present, otherwise immediate refresh
9. `setTimeout(..., 0)`
10. `tutorialController.refreshCurrentHighlight()`
11. return handled `true`

### Detail And Page Actions

Current wrappers call `CanvasPanelSurfaceManager.runPanelAction()` with `{ render:false }`
and then rely on `afterHandled()` / `renderCanvasAction()` to refresh only the panel
surface.

| Action | Panel action | State effect | Tutorial side effect |
|---|---|---|---|
| `openFamousPersonDetail` | `openDetail` | `selectedFamousPersonId = action.personId || ''`, tooltip cleared | `onFamousPersonDetailOpened(personId)`, immediate highlight refresh, next-tick refresh |
| `closeFamousPersonDetail` | `closeDetail` | `selectedFamousPersonId = ''`, tooltip cleared | immediate highlight refresh, next-tick refresh |
| `changeFamousPersonsPage` | `changePage` | `famousPersonsPage = max(0, current + delta)`, `selectedFamousPersonId = ''`, tooltip cleared | none |

### Async Famous API Commands

These are the equivalence truth for Slice 8a.

| Command | Success trace | Failure trace | Tutorial side effect |
|---|---|---|---|
| `seekFamousPerson(source)` | `api.seekFamousPerson(source)` -> `applyApiState(result, { render:false })` -> `log(result.message || command.famous.seekComplete)` -> `openPanel('famousPersons')` -> panel state resets and overlay refreshes | `log(command.famous.seekFailed)` -> `refreshPanelSurface('famousPersons')` | controller wrapper calls `onFamousPersonSought(result || {})` after success |
| `acceptFamousPerson(candidateId)` | `api.acceptFamousPerson(candidateId)` -> `applyApiState(result, { render:false })` -> `log(result.message || command.famous.accepted)` -> `openPanel('famousPersons')` | `log(command.famous.acceptFailed)` -> `refreshPanelSurface('famousPersons')` | none |
| `dismissFamousPersonCandidate(candidateId)` | `api.dismissFamousPersonCandidate(candidateId)` -> `applyApiState(result, { render:false })` -> `log(result.message || command.famous.dismissed)` -> `openPanel('famousPersons')` | `log(command.famous.dismissFailed)` -> `refreshPanelSurface('famousPersons')` | none |
| `assignFamousAttributePoint(personId, attribute)` | `api.assignFamousAttributePoint(personId, attribute)` -> `applyApiState(result, { render:false })` -> `openPanel('famousPersons', { render:false })` -> `runPanelAction('famousPersons', 'openDetail', { personId }, { render:false })` -> `log(result.message || command.famous.attributeUpgraded)` -> `refreshPanelSurface('famousPersons')` | `log(command.famous.attributePointFailed)` -> `refreshPanelSurface('famousPersons')` | none |

Important silent-reopen lock: successful async reopen for seek/accept/dismiss/assign must
not fire `onFamousPersonsOpened`, `onFamousPersonDetailOpened`, or their highlight
refresh chain unless explicitly listed above. Only seek fires `onFamousPersonSought`.

### Surface And Hit Target Locks

- Opening a panel snapshots current renderer hit targets into `baseHitTargetsByPanel`
  before painting panel overlay targets.
- Closing a panel clears the panel overlay surface and restores the latest base hit
  target snapshot.
- A full-frame/base render can overwrite renderer hit targets; while famous is open,
  `syncOpenPanelSurfacesAfterBaseRender()` deletes the stale snapshot, refreshes
  `famousPersons`, and makes panel targets authoritative again.
- Closing after a base-render sync restores the fresh base target list, not the
  open-time target list.
- Representative famous overlay targets include background close
  `closeFamousPersons`, back/close `closeFamousPersons` or `closeFamousPersonDetail`,
  pager `changeFamousPersonsPage`, seek `seekFamousPerson`, candidate accept/dismiss,
  detail cards `openFamousPersonDetail`, and attribute buttons
  `assignFamousAttributePoint`.

### Entrypoint Locks

- H5 loads `CanvasActionController.js` before panel files, then loads
  `FamousPersonsPanel.js`, `CanvasPanelRegistry.js`, `CanvasPanelSurfaceManager.js`,
  `CanvasGameApp.js`, and later `CanvasActionDispatchRegistry.js` /
  `CanvasActionDispatcher.js`.
- Minigame requires `CanvasActionDispatcher` early, then `CanvasActionController`,
  then `FamousPersonsPanel`, `CanvasPanelRegistry`, `CanvasPanelSurfaceManager`, and
  finally `CanvasGameApp`.
- Retired `CanvasFamousActionHandlers.js` is not loaded by either entrypoint.

## Current Compatibility Counters

The counters required by spec Section 6.10 do not exist yet on this base. Their Slice 0
state is `not implemented`. The active compatibility paths they must later count are:

- `panelSurface.syncAfterBaseRender.count`: current path exists as
  `syncOpenPanelSurfacesAfterBaseRender()`;
- `panelSurface.baseHitTargetsSnapshot.count`: current path exists as
  `baseHitTargetsByPanel`;
- `panelAction.controllerWrapper.count`: current famous wrapper methods exist on
  `CanvasActionController`;
- `panelAction.dispatcherFallback.count`: current dispatcher fallback path still exists;
- `panelSurface.refreshAlias.count`: current direct refresh aliases still exist through
  App/Shell panel-surface helpers.

Slice 8b retirement may only pass when these counters exist in dev/test and report zero
for the retired paths.

## Baseline Trace Shape

Slice 8a comparison traces should use this stable shape:

```json
{
  "schema": "button-scheduler-manager-panel-trace-v1",
  "panel": "famousPersons",
  "action": "openFamousPersons",
  "handled": true,
  "callbacks": [
    "canOpenTab:famousPersons",
    "panel.open:famousPersons",
    "renderCanvasAction:openFamousPersons",
    "tutorial.onFamousPersonsOpened",
    "tutorial.refreshCurrentHighlight",
    "scheduler.setTimeout:0",
    "tutorial.refreshCurrentHighlight"
  ],
  "state": {
    "showFamousPersons": true,
    "famousPersonsPage": 0,
    "selectedFamousPersonId": ""
  },
  "renderSlots": ["modal"],
  "compatCounters": {
    "panelSurface.syncAfterBaseRender.count": "not-implemented",
    "panelSurface.baseHitTargetsSnapshot.count": "not-implemented",
    "panelAction.controllerWrapper.count": "not-implemented",
    "panelAction.dispatcherFallback.count": "not-implemented",
    "panelSurface.refreshAlias.count": "not-implemented"
  }
}
```

Comparison command after Slice 8a should include the focus command above plus the new
equivalence trace tests added during the port. The expected result is semantic equality
with the locks in this document, except that Slice 8b must convert compatibility counter
values from active/not-implemented paths to explicit zero counts.
