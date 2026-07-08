# Button -> Scheduler -> Manager -> Panel Refactor Spec

Status: Draft for owner review
Date: 2026-07-09
Scope: frontend canvas UI panel action, scheduling, projection, and panel ownership
Primary reference panel: `famousPersons`

## 1. Problem Statement

The canvas UI currently contains the shape of the intended architecture, but the route is not yet a single route.

The desired route is:

```text
button / hit target
  -> action dispatcher
  -> stage scheduler
  -> panel surface manager
  -> panel registry
  -> independent panel file
```

The `famousPersons` panel is the best current reference because it already has:

- button renderers that emit action objects instead of opening UI directly;
- `FamousPersonsPanel` as an independent panel file;
- `CanvasPanelRegistry` registration;
- `CanvasPanelSurfaceManager` as the panel overlay entry;
- panel-only refresh behavior through `renderPanelCanvasAction`.

However, the current implementation still has parallel ownership:

- canvas taps primarily call `CanvasActionController.handle()`, while `CanvasActionDispatcher` exists but is not the main path;
- `CanvasActionController` still owns famous panel business sequencing directly;
- `CanvasPanelSurfaceManager` still carries open/close methods and `baseHitTargetsByPanel` bookkeeping;
- `CanvasGameApp.renderPanelCanvasAction()` contains a famous-persons action whitelist;
- base frame rendering can still affect panel hit targets, with `syncOpenPanelSurfacesAfterBaseRender()` acting as a repair layer;
- panel pixels, modal state, and hit targets are not yet derived from one scheduled modal pass.

This refactor makes the panel path explicit, reviewable, and incrementally adoptable without changing user-visible panel behavior in the first landing slices.

## 2. Goals

1. Buttons and renderers only emit action intent.
2. Action dispatch becomes the single route for panel intent.
3. Panel actions dirty only the `modal` stage unless they explicitly require another stage.
4. Panel pixels are projected by a manager from registered panel entries.
5. Each panel lives in an independent file and exposes a small lifecycle/action/render contract.
6. Famous-persons behavior remains byte-for-behavior equivalent during the first migration.
7. Existing App/Shell/mini-game routes keep working during migration through compatibility wrappers.
8. The design prepares for hit target pool separation, but does not force that high-risk step into the first landing slice.

## 3. Non-Goals

The first landing slice does not:

- redesign any panel visuals;
- introduce `PanelChrome`;
- migrate all blocking panels at once;
- remove `CanvasActionController`;
- rewrite tutorial guide flow;
- change backend APIs or state schema;
- change deployment behavior;
- require server-side validation.

## 4. Current Reference Path: Famous Persons

### 4.1 Button Sources

`TabBarCanvasRenderer` treats `famousPersons` as an action tab and emits:

```js
{ type: 'openFamousPersons', disabled: isLocked }
```

`MapCommandCanvasRenderer` emits:

```js
{ type: 'openFamousPersons' }
```

These are good and should remain the renderer contract.

### 4.2 Current Action Path

The effective runtime path is:

```text
renderer.getHitTarget(point)
  -> CanvasGameApp.handleTap() / CanvasGameShell.handleAction()
  -> actionController.handle(action)
  -> CanvasActionController.handle_openFamousPersons()
  -> CanvasPanelSurfaceManager.openPanel('famousPersons')
  -> FamousPersonsPanel.open()
  -> actionController.afterHandled()
  -> host.renderCanvasAction(action)
  -> panelSurfaceManager.refreshPanelSurface('famousPersons')
```

`CanvasActionDispatcher` and `CanvasActionDispatchRegistry` are present, loaded, and tested, but they are not yet the main action path for taps.

### 4.3 Current Panel Path

`CanvasPanelRegistry` currently registers:

```js
famousPersons: FamousPersonsPanel
```

`FamousPersonsPanel` owns:

- open/close modal snapshot mutation;
- competing panel close sweep;
- `famousPersonsPage` reset/change;
- `selectedFamousPersonId` open/close detail;
- tooltip clearing;
- render delegation to `FamousPanelCanvasRenderer`.

This is the correct direction and should be preserved.

### 4.4 Current Render Path

`CanvasGameApp.renderCanvasAction()` routes famous panel actions to:

```js
getPanelSurfaceManager().refreshPanelSurface('famousPersons', { action })
```

This protects against full-frame redraw, but it is currently a hard-coded action whitelist. The scheduler should own this decision.

## 5. Target Architecture

### 5.1 Ownership Table

| Layer | Owner | Responsibility | Must Not Do |
|---|---|---|---|
| Button / hit target | Renderer files | Emit action intent | Open, close, render, mutate panel state |
| Action dispatcher | `CanvasActionDispatcher` + registry | Resolve action to command | Draw pixels, own modal state |
| Stage scheduler | `CanvasStageScheduler` | Dirty `base`, `modal`, `guide`; coalesce flush | Know panel internals |
| Panel manager | `CanvasPanelSurfaceManager` | Project registered open panels onto panel layer | Own business rules long-term |
| Panel registry | `CanvasPanelRegistry` | Declare available panel entries | Mutate state |
| Panel file | `FamousPersonsPanel`, later others | Panel lifecycle, local panel actions, render hook | Trigger full-frame render |

### 5.2 Intended Runtime Route

```text
hit target action
  -> CanvasActionDispatcher.handle(action, context)
  -> CanvasPanelActionRegistry.resolve(action)
  -> panel command runs lifecycle/action function
  -> CanvasStageScheduler.markDirty('modal', reason)
  -> scheduler flushes modal
  -> CanvasPanelSurfaceManager.projectModalLayer()
  -> CanvasPanelRegistry open entries render
```

### 5.3 Compatibility Route During Migration

Until App/Shell are switched to dispatcher-first input handling:

```text
actionController.handle_openFamousPersons()
  -> PanelActionRunner.run(action, context)
```

The controller method remains as a compatibility wrapper only. It must not contain panel business details after migration.

## 6. Proposed Contracts

### 6.1 Panel Action Definition

Panel actions are declared data, not switch-case behavior spread across host classes.

```js
{
  type: 'openFamousPersons',
  panelKey: 'famousPersons',
  operation: 'open',
  dirty: ['modal'],
}
```

Detail/page actions map to panel-local action names:

```js
{
  type: 'openFamousPersonDetail',
  panelKey: 'famousPersons',
  operation: 'action',
  actionName: 'openDetail',
  dirty: ['modal'],
}
```

### 6.2 Panel Entry Contract

Initial contract:

```js
{
  key: 'famousPersons',
  modalKey: 'showFamousPersons',
  band: 'panel',
  isOpen(host, options) {},
  open(host, options) {},
  close(host, options) {},
  actions: {
    openDetail(host, action, options) {},
    closeDetail(host, action, options) {},
    changePage(host, action, options) {},
  },
  render(renderer, state, options) {},
}
```

During migration, legacy direct methods such as `panel.openDetail()` may remain. The registry adapter can normalize them into `actions`.

### 6.3 Scheduler Contract

Minimal first version:

```js
markDirty(slot, reason, payload)
flush(slots)
flushAll()
```

Slots:

- `base`: main HUD / base frame
- `modal`: panel overlay projection
- `guide`: tutorial / guide overlay, later

First landing behavior:

- panel actions mark only `modal`;
- regular action-controller `afterHandled()` may still mark/render `base` through existing compatibility;
- immediate flush is allowed in tests and compatibility paths;
- rAF coalescing can land after the action route is stable.

### 6.4 Manager Contract

Transition contract:

```js
openPanel(panelKey, options)
closePanel(panelKey, options)
runPanelAction(panelKey, actionName, action, options)
refreshPanelSurface(panelKey, options)
projectModalLayer(options)
```

Long-term contract:

```js
projectModalLayer(options)
```

The first landing slice may retain `openPanel`, `closePanel`, and `runPanelAction`. Their implementation should become thin:

1. get panel entry;
2. run panel lifecycle/action;
3. mark `modal` dirty or refresh modal through the scheduler;
4. return handled state.

## 7. Landing Plan

### Slice 0: Baseline and Spec Lock

Purpose: freeze behavior before routing changes.

Deliverables:

- this spec reviewed and approved;
- famous-persons tap/action behavior documented;
- current tests identified as behavior locks.

Behavior locks:

- tutorial `canOpenTab('famousPersons') === false` must not mutate modal owner;
- opening famous persons resets game-owned famous panel state but not shell-local stale fields;
- closing famous persons triggers tutorial close/refresh behavior;
- detail/page actions redraw only panel overlay;
- async famous API actions reopen/refresh only the panel surface.

### Slice 1: Panel Action Registry

Purpose: move famous action mapping out of controller switch bodies.

Add a small panel action registry, either:

- `frontend/js/platform/CanvasPanelActionRegistry.js`, or
- a dedicated section inside `CanvasActionDispatchRegistry.js`.

Recommended: new `CanvasPanelActionRegistry.js` to keep panel command mapping reviewable.

Initial entries:

- `openFamousPersons`
- `closeFamousPersons`
- `openFamousPersonDetail`
- `closeFamousPersonDetail`
- `changeFamousPersonsPage`

The registry resolves an action into a panel command descriptor. It does not execute the command by itself.

### Slice 2: Panel Action Runner

Purpose: centralize execution of panel commands.

Add `CanvasPanelActionRunner` or equivalent helper.

Responsibilities:

- enforce tutorial open veto for `openFamousPersons`;
- call `manager.openPanel`, `manager.closePanel`, or `manager.runPanelAction`;
- trigger tutorial callbacks in the same order as today;
- request modal refresh through scheduler/compat render hook;
- return the same handled boolean as current controller methods.

The existing `CanvasActionController.handle_*Famous*` methods become compatibility wrappers:

```js
handle_openFamousPersons(action) {
  return this.panelActionRunner.run(action, this.getPanelActionContext());
}
```

### Slice 3: Minimal Stage Scheduler

Purpose: replace famous action render whitelist with a modal dirty slot.

Add `CanvasStageScheduler` with only `modal` fully wired at first.

For famous panel actions:

```text
handled -> scheduler.markDirty('modal', action.type) -> scheduler.flush(['modal'])
```

The flush path calls:

```js
panelSurfaceManager.refreshPanelSurface('famousPersons', { action })
```

This slice may still project only one panel key. General open-set projection lands later.

### Slice 4: Registry Entry Upgrade

Purpose: make `CanvasPanelRegistry` a declaration table, not a raw object map.

Upgrade from:

```js
famousPersons: FamousPersonsPanel
```

to:

```js
{
  famousPersons: {
    key: 'famousPersons',
    modalKey: 'showFamousPersons',
    band: 'panel',
    module: FamousPersonsPanel,
    ...
  }
}
```

The registry still exposes:

- `get(panelKey)`
- `has(panelKey)`
- `keys()`

The manager may normalize old and new entry shapes during this slice.

### Slice 5: Dispatcher-First Adoption

Purpose: make the runtime route match the architecture.

App/Shell tap handlers should try dispatcher-first for supported actions:

```text
if actionDispatcher.canHandle(action):
  handled = actionDispatcher.handle(action, context)
else:
  handled = actionController.handle(action, meta)
```

Fallback remains during migration.

Required context shape:

- `getState`
- `getPanelSurfaceManager`
- `getGameHost`
- `render`
- `scheduler`
- `tutorialController`
- `showFloatingText`
- `log`

The dispatcher should not need to know whether it is running on App or Shell.

### Slice 6: Modal Projection Generalization

Purpose: move from per-panel refresh to open-set projection.

Manager behavior becomes:

```text
read panel facts / modal snapshot
find open registry entries
clear panel overlay once
render entries in band/priority order
hide layer if no entries are open
```

`refreshPanelSurface(panelKey)` remains as a compatibility alias that marks `modal` dirty.

This is the point where other panels can start migrating into registry entries.

### Slice 7: Hit Target Pools

Purpose: remove base/panel hit target collisions.

Introduce named pools:

- `base`
- `modal`
- `guide`

Rules:

- base frame can clear/rebuild only `base`;
- modal projection can clear/rebuild only `modal`;
- guide overlay can clear/rebuild only `guide`;
- resolver reads a merged ordered view.

After this lands:

- remove `baseHitTargetsByPanel`;
- remove `syncOpenPanelSurfacesAfterBaseRender`;
- remove base-render panel target repair calls.

This slice should not be combined with dispatcher migration.

### Slice 8: PanelChrome and Wider Panel Migration

Purpose: reduce each panel file to content plus local actions.

Only after slices 1-7 are stable:

- introduce shared panel chrome;
- migrate settings/logs/advisor/taskCenter/etc. one at a time;
- keep each panel migration independently reviewable.

## 8. Testing Plan

### Unit Tests

Add or update:

- `CanvasPanelActionRegistry.test.js`
- `CanvasPanelActionRunner.test.js`
- `CanvasStageScheduler.test.js`
- `CanvasActionDispatcher.test.js`
- `CanvasActionControllerFamous.test.js`
- `CanvasPanelSurfaceManager.test.js`
- `FamousPersonsPanel.test.js`

### Integration Tests

Keep or extend:

- `CanvasGameApp.test.js`
- `CanvasGameShell.test.js`
- `CanvasGameAppTripleHostMirror.test.js`

### Required Behavior Assertions

For famous persons:

1. disabled action returns handled and does not mutate;
2. tutorial veto returns false and does not open/close/reset anything;
3. allowed open order remains:
   - `canOpenTab`
   - panel open
   - render/dirty modal
   - tutorial opened callback
   - highlight refresh
   - scheduled highlight refresh
4. close order remains compatible with current tests;
5. detail/page actions dirty only modal;
6. API actions `seek/accept/dismiss/assignAttribute` keep panel overlay refresh behavior;
7. tooltip show/clear keeps panel-only refresh when panel is open;
8. no full-frame render is introduced for panel-only actions.

### Suggested Focus Command

```powershell
node --test `
  frontend/js/platform/CanvasActionDispatcher.test.js `
  frontend/js/platform/CanvasActionControllerFamous.test.js `
  frontend/js/platform/CanvasPanelSurfaceManager.test.js `
  frontend/js/platform/panels/FamousPersonsPanel.test.js `
  frontend/js/platform/CanvasGameApp.test.js `
  frontend/js/platform/CanvasGameShell.test.js
```

## 9. Risk Register

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Tutorial open veto order changes | Can leak locked famous tab | Characterization tests before code movement |
| App/Shell ownership confusion | Famous state owner differs between shell and mounted game | Keep `getUiStateOwner()` semantics unchanged |
| Dispatcher and controller both execute | Double open/render/tutorial callback | Dispatcher-first adoption must have single fallback boundary |
| Scheduler flush changes timing | Tutorial highlight may query stale target | First scheduler slice can flush synchronously for modal |
| Manager still owns hit target repair | Can hide later pool bugs | Treat repair logic as temporary until hit pool slice |
| Async famous API actions regress | Panel may close or full render after API result | Keep current `applyApiState(..., { render:false })` contract |
| Mini-game load order breaks | Browser globals rely on script order | Keep dispatcher/registry load-order tests |
| Tooltip refresh path is special | Tooltip uses renderer state and panel open check | Include tooltip show/clear tests in modal dirty path |

## 10. Review Decisions Needed

1. Should `CanvasPanelActionRegistry` be a new file, or should panel mappings live inside `CanvasActionDispatchRegistry`?
2. Should Slice 1 keep `CanvasActionController` as the runtime entry, or should App/Shell become dispatcher-first immediately?
3. Should the first scheduler implementation flush modal synchronously, or always coalesce through rAF?
4. Should `CanvasPanelSurfaceManager.refreshPanelSurface(panelKey)` remain public after modal projection generalizes?
5. Is `famousPersons` the only approved first sample, or should `settings` be migrated in the same batch after the seam exists?

## 11. Recommended First Implementation Batch

Recommended first code batch:

```text
Slice 1 + Slice 2 only
```

Files likely touched:

- `frontend/js/platform/CanvasPanelActionRegistry.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasActionDispatchRegistry.js` only if dispatcher registration must expose panel actions
- `frontend/js/platform/CanvasActionDispatcher.test.js`
- `frontend/js/platform/CanvasActionControllerFamous.test.js`
- new focused tests for registry/runner

Expected outcome:

- no runtime behavior change;
- famous-person action business logic moves out of `CanvasActionController`;
- controller famous handlers become compatibility wrappers;
- the next batch can introduce `CanvasStageScheduler` without also moving business logic.

This batch is intentionally small. It creates the seam that all later slices need, while keeping the high-risk scheduling and hit-target pool changes out of the first review.

