# Button -> Scheduler -> Manager -> Panel Refactor Spec

Status: Draft for owner review, root-cause-loop revision
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
9. Every temporary compatibility wrapper has an explicit retirement slice and removal gate.
10. Panel action resolution has exactly one runtime entry point; descriptor registries may exist, but they must not execute or independently dispatch.
11. App/Shell/mini-game host differences are hidden behind a normalized context adapter, not optional same-name fields.
12. Async panel-affecting commands and tooltip commands are included in the modal dirty contract instead of staying as untracked special cases.
13. The first implementation cycle must land at the green root-cause state: single action route, stage scheduler, modal projection, hit target pools, and compatibility retirement together.
14. Intermediate slices are implementation checkpoints only; they are not acceptable long-lived architecture states.

## 3. Non-Goals

The first landing slice does not:

- redesign any panel visuals;
- introduce `PanelChrome`;
- migrate all blocking panels at once;
- remove `CanvasActionController` in the first landing slice;
- leave `CanvasActionController` famous wrappers as a long-lived state;
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

Important current split:

- `CanvasActionDispatchRegistry.RENDER_ACTIONS` already contains the five famous action types: `openFamousPersons`, `closeFamousPersons`, `changeFamousPersonsPage`, `openFamousPersonDetail`, and `closeFamousPersonDetail`.
- Those entries currently call host context methods such as `context.openFamousPersons(action)`.
- The Shell host methods are not behavior-equivalent to `CanvasActionController.handle_*Famous*`: Shell `openFamousPersons()` opens the manager panel directly and does not run the tutorial open gate or the full open callback/refresh sequence.
- Slice 1 therefore takes over an already existing but bypassed dispatch route. It is not creating dispatcher support from zero.

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
  -> CanvasActionDispatchRegistry.dispatch(action, context)
  -> branch order: switchTab -> panel descriptor -> FINISH_ACTIONS -> RENDER_ACTIONS
  -> CanvasPanelActionRegistry.resolve(action)
  -> CanvasPanelActionRunner.run(action, context)
  -> CanvasStageScheduler.markDirty('modal', reason)
  -> scheduler flushes modal
  -> CanvasPanelSurfaceManager.projectModalLayer()
  -> CanvasPanelRegistry open entries render
```

The branch order above is frozen. When a panel descriptor exists for an action, the action must not fall through to the legacy `FINISH_ACTIONS` or `RENDER_ACTIONS` maps. The five famous entries must be removed from `RENDER_ACTIONS` when the panel descriptor branch is activated.

### 5.3 Compatibility Route During Migration

Until App/Shell are switched to dispatcher-first input handling:

```text
actionController.handle_openFamousPersons()
  -> PanelActionRunner.run(action, context)
```

The controller method remains as a compatibility wrapper only. It must not contain panel business details after migration.

Legacy App/Shell same-name famous methods (`openFamousPersons`, `closeFamousPersons`, `changeFamousPersonsPage`, `openFamousPersonDetail`, `closeFamousPersonDetail`) may exist only as compatibility entry points. No new dispatcher path may call them for famous panel actions after the descriptor branch lands. By the end of Slice 2 they must either forward to `PanelActionRunner.run(action, context)` or be bypassed entirely; by Slice 8b they are retired with the controller wrappers.

### 5.4 Feedback-Integrated Architecture Constraints

These constraints close the major review issues and are normative for implementation.

1. **Single executable action route**

   `CanvasActionDispatchRegistry` remains the only runtime registry that answers `canHandle(action)` and `dispatch(action, context)`.
   A new `CanvasPanelActionRegistry` may exist, but only as a descriptor table consumed by `CanvasActionDispatchRegistry`.
   It must not expose a second runtime dispatcher, and it must not be called independently by App/Shell tap handlers.

2. **No double execution boundary**

   Dispatcher-first migration uses one boundary:

   ```text
   if dispatcher handled or explicitly supports action -> do not call controller
   else -> call controller fallback
   ```

   The fallback decision happens before any action side effect. A panel action must never execute once through dispatcher and again through `CanvasActionController`.

3. **Host context is adapted, not guessed**

   App, Shell, and mini-game must provide panel actions through a normalized context object built by one adapter.
   Dispatch/runner code consumes the adapter only; it must not branch on "is this App or Shell?"

4. **Famous-person tutorial behavior is data-driven**

   The first implementation may encode famous-person tutorial hooks in descriptors, but the runner must execute generic hooks.
   It must not hardcode `openFamousPersons` as a permanent special case. A future panel with tutorial hooks should add descriptor data, not runner code.

5. **Modal flush starts synchronous**

   Slice 3 uses synchronous modal flush after a handled user action. This preserves the current contract that hit targets are immediately queryable before tutorial highlight refresh.
   rAF coalescing is a later optimization and must be gated by action-sequence, hit-target, and tutorial-callback equivalence tests.

6. **Compatibility is time-boxed by gates**

   Every compatibility alias/wrapper added or retained by this spec has a named removal gate in Section 6.10. The implementation should add comments naming the gate where the compatibility code lives.

### 5.5 Root-Cause Loop Commitment

This revision chooses the root-cause loop over a long incremental stop. The implementation may still be committed in reviewable internal steps, but the target cycle is accepted only when all root causes below are closed together:

| Root cause | Closed by |
|---|---|
| action execution has controller/dispatcher parallel paths | dispatcher-first route with controller famous wrappers retired |
| App/Shell/mini-game host ownership is inferred ad hoc | shared panel action context adapter, including `getUiStateOwner()` |
| panel actions rely on hardcoded render whitelists | `CanvasStageScheduler` modal dirty/flush path |
| panel pixels are refreshed per panel instead of projected from open state | `CanvasPanelSurfaceManager.projectModalLayer()` open-set projection |
| base render and panel render share one hit target pool | named `base`, `modal`, and `guide` hit target pools |
| panel outside-click/background behavior is panel-local and duplicated | manager/projection-owned modal background target driven by panel metadata |
| famous tooltip and async API commands are hardcoded side paths | descriptor/command routes that dirty `modal` through the same scheduler |
| repair mechanisms hide conflicts | `syncOpenPanelSurfacesAfterBaseRender()` and `baseHitTargetsByPanel` removed |

The root-cause loop has one green exit:

```text
renderer action
  -> CanvasActionDispatcher
  -> descriptor-backed PanelActionRunner
  -> CanvasStageScheduler.markDirty('modal')
  -> CanvasStageScheduler.flush(['modal'])
  -> CanvasPanelSurfaceManager.projectModalLayer()
  -> named hit target pools resolve guide/modal/base
```

No production path may remain on the old famous-person controller wrappers, public per-panel refresh alias, or base-render panel repair path after the loop is accepted.

## 6. Proposed Contracts

### 6.1 Panel Action Definition

Panel actions are declared data, not switch-case behavior spread across host classes.

```js
{
  type: 'openFamousPersons',
  panelKey: 'famousPersons',
  operation: 'open',
  dirty: ['modal'],
  hooks: {
    beforeOpen: 'tutorialCanOpenTab',
    afterOpen: ['tutorialOnOpened', 'tutorialRefreshNow', 'tutorialRefreshNextTick'],
  },
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
  hooks: {
    afterAction: ['tutorialOnDetailOpened', 'tutorialRefreshNow', 'tutorialRefreshNextTick'],
  },
}
```

Close actions declare their own post-action hook list. `closeFamousPersons` is not an unhooked lifecycle call:

```js
{
  type: 'closeFamousPersons',
  panelKey: 'famousPersons',
  operation: 'close',
  dirty: ['modal'],
  hooks: {
    afterClose: ['tutorialOnClosed', 'tutorialRefreshNextTick'],
  },
}
```

Runtime ownership:

- `CanvasActionDispatchRegistry` owns action support and dispatch.
- `CanvasPanelActionRegistry` owns only the descriptor data above. The file must include a header that distinguishes it from `frontend/js/platform/panels/CanvasPanelRegistry.js`, which is the panel module/entry registry.
- `CanvasPanelActionRunner` owns execution of a descriptor.
- `CanvasActionController` wrappers may call the runner during migration, but they must not duplicate descriptor logic.

Hook execution semantics:

- `action.disabled === true` is short-circuited at the earliest unified action entry and returns `true` without running hooks, panel methods, dirty marking, or flush. The runner must also keep a defensive disabled check while compatibility paths exist.
- `beforeOpen` hooks run before panel lifecycle. If any `beforeOpen` hook returns `false`, the action returns `false`, no panel lifecycle runs, no close-on-open sweep runs, no tooltip is cleared, no dirty slot is marked, no render/flush/scheduled refresh runs, and no after hook runs.
- `tutorialCanOpenTab` veto preserves current player feedback: call `context.showFloatingText(context.t('guide.completeCurrentStep'))`; if no floating text surface exists, fall back to `context.log(message)`.
- after hooks run only after the panel lifecycle/action succeeds.
- hook arrays run in declared order. Famous open order is `tutorialOnOpened`, `tutorialRefreshNow`, `tutorialRefreshNextTick`; close order is `tutorialOnClosed`, `tutorialRefreshNextTick`; detail-open order is `tutorialOnDetailOpened`, `tutorialRefreshNow`, `tutorialRefreshNextTick`.
- hook implementations are named constants owned by the runner/hook registry; panel descriptors reference names, not arbitrary functions.
- covered normal/veto/async-rejection behavior remains equivalent to current famous tests. Synchronous hook throws are not a stable current baseline; this spec defines them as fail-closed: log, stop subsequent hooks, do not roll back prior panel state, and do not run later after hooks unless a descriptor explicitly marks a hook as `continueOnError`.
- async hook rejection is caught and logged.

Hook binding table:

| Hook name | Target behavior | Parameters | Scheduling | Current source |
|---|---|---|---|---|
| `tutorialCanOpenTab` | `tutorialController.canOpenTab(tabId)` | `panelKey`, currently `'famousPersons'` | sync veto hook | `CanvasActionController.handle_openFamousPersons()` |
| `tutorialVetoFeedback` | `context.showFloatingText(context.t('guide.completeCurrentStep'))`, fallback `context.log(message)` | localized message | sync feedback after veto | `CanvasActionController.handle_openFamousPersons()` |
| `tutorialOnOpened` | `tutorialController.onFamousPersonsOpened()` | none | sync call; catch returned Promise rejection | `CanvasActionController.handle_openFamousPersons()` |
| `tutorialOnClosed` | `tutorialController.onFamousPersonsClosed()` if present, otherwise `tutorialController.refreshCurrentHighlight()` | none | sync call; catch returned Promise rejection | `CanvasActionController.handle_closeFamousPersons()` |
| `tutorialOnDetailOpened` | `tutorialController.onFamousPersonDetailOpened(personId)` | `action.personId || ''` | sync call; catch returned Promise rejection | `CanvasActionController.handle_openFamousPersonDetail()` |
| `tutorialOnFamousPersonSought` | `tutorialController.onFamousPersonSought(result || {})` | API result | after successful seek result | `CanvasActionController.handle_seekFamousPerson()` |
| `tutorialRefreshNow` | `tutorialController.refreshCurrentHighlight()` | none | sync | famous open/detail handlers; close uses the `tutorialOnClosed` fallback above |
| `tutorialRefreshNextTick` | `tutorialController.refreshCurrentHighlight()` | none | `runtimeScheduler.setTimeout(callback, 0)` | famous open/close/detail handlers |

The close fallback in `tutorialOnClosed` is intentionally preserved for the first root-cause loop. Removing that fallback would be a later behavior change with its own equivalence tests.

### 6.2 Panel Entry Contract

Initial contract:

```js
{
  key: 'famousPersons',
  modalKey: 'showFamousPersons',
  band: 'panel',
  renderPriority: 100,
  hitTargetPriority: 100,
  closesOnOutsideClick: true,
  blocksBaseHitTargets: true,
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

Metadata rules:

- `band` controls broad paint group. Initial values: `panel`, later `dialog`.
- `renderPriority` controls ordering inside a band. Higher priority renders later.
- `hitTargetPriority` controls ordering inside the future `modal` hit target pool. Higher priority resolves first.
- `closesOnOutsideClick` declares whether the shared panel chrome/background target may close the panel.
- `blocksBaseHitTargets` declares whether base hit targets are masked while this panel is open.

The first `famousPersons` migration should set these fields even if only one panel is registered. That prevents Slice 6 from requiring a second entry-shape migration.

Outside-click and base-blocking semantics:

| `closesOnOutsideClick` | `blocksBaseHitTargets` | Outside panel behavior |
|---|---|---|
| `true` | `true` | close panel and do not pass through to base |
| `true` | `false` | close panel and pass through to base only if the panel explicitly opts into pass-through and has a hit-target equivalence test |
| `false` | `true` | keep panel open and do not pass through to base |
| `false` | `false` | keep panel open and pass through to base only for explicitly non-modal overlays |

`famousPersons` starts with `closesOnOutsideClick: true` and `blocksBaseHitTargets: true`.

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

Naming:

- `CanvasStageScheduler` is the UI stage dirty scheduler described here.
- runtime scheduler means the existing runtime/timer surface with `setTimeout`/`setInterval`.
- `CanvasGameAppRenderScheduler` is an existing render/timer helper and is not the new stage scheduler. `CanvasStageScheduler.js` must include a file header stating this distinction.

Instance ownership:

- App hosts own one `CanvasStageScheduler`.
- Shell hosts own one `CanvasStageScheduler`.
- mini-game uses the mounted `CanvasGameApp` scheduler and must not receive a separate simplified scheduler.
- no global shared scheduler instance is allowed.

First landing behavior:

- panel actions mark only `modal`;
- regular action-controller `afterHandled()` may still mark/render `base` through existing compatibility;
- modal flush is synchronous after each handled user action in Slice 3;
- a descriptor may mark multiple slots, but `modal` and `base` writes must be explicit and test-covered;
- rAF coalescing can land only after equivalence tests show hit targets and tutorial callbacks do not drift.

Batching rule:

```js
scheduler.runAtomic(() => {
  run(openFamousPersons);
  run(openFamousPersonDetail);
}, { flush: ['modal'] });
```

When multiple panel actions are intentionally chained in one macro-task, use an explicit atomic section. Without `runAtomic`, each handled user action flushes modal synchronously.

`runAtomic` rules:

- it batches dirty slots and flushes once at the end;
- a `beforeOpen` veto stops the atomic block, does not roll back already executed actions, and flushes dirty slots for already executed actions;
- an exception stops the atomic block by default, logs the error, and flushes dirty slots for already executed actions;
- a descriptor may explicitly opt into `continueOnError` for safe non-mutating hooks/actions;
- cross-panel atomic operations are allowed only for close-A/open-B style transitions that are covered by tests.

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

Manager boundary:

- Before Slice 6, manager lifecycle methods are compatibility entry points.
- After Slice 6, new code must call panel actions through dispatcher/runner and call manager only for projection.
- After Slice 7, manager must not own hit target repair state.

Manager/scheduler boundary:

- `openPanel()`, `closePanel()`, and `runPanelAction()` may mark `modal` dirty while they remain as compatibility methods, but they must not call `flush()`.
- `refreshPanelSurface(panelKey)` is a compatibility alias for marking/flushing modal through the scheduler during migration. It must not remain a public business API after the root-cause loop.
- `projectModalLayer()` immediately projects the modal layer and is called only by `CanvasStageScheduler.flush(['modal'])` or tests.
- user-click actions flush modal through dispatcher/controller after runner execution;
- async API callbacks that affect an open/reopened panel must explicitly flush modal through scheduler after state application.

### 6.5 Normalized Panel Action Context

The runner receives a single normalized context object:

```js
{
  host,
  getGameHost() {},
  getUiStateOwner() {},
  getState() {},
  getPanelSurfaceManager() {},
  getScheduler() {},
  getRuntimeScheduler() {},
  getTutorialController() {},
  renderAction(action) {},
  showFloatingText(message) {},
  t(key, params) {},
  log(errorOrMessage) {},
}
```

Provider rules:

- App context and Shell context are built by the same adapter module.
- `getGameHost()` resolves `host.getCanvasGameHost?.() || host.lastGame || host`, matching current action-controller behavior.
- `getUiStateOwner()` resolves the mounted game owner when present and otherwise returns `host`, matching current famous panel behavior:

  ```js
  const game = host?.getCanvasGameHost?.() || host?.lastGame || null;
  return game && game !== host ? game : host;
  ```

- `getTutorialController()` must resolve Shell -> mounted game -> host, matching current famous behavior.
- `getGameHost()` and `getUiStateOwner()` are different on purpose. `getGameHost()` resolves controller/service handles such as tutorial, event, API, and runtime objects. `getUiStateOwner()` resolves the object that owns UI state fields such as `famousPersonsPage` and `selectedFamousPersonId`.
- `renderAction(action)` must preserve current App/Shell behavior: panel actions route to modal refresh; non-panel compatibility may still call the existing render path.
- `showFloatingText(message)` preserves the current fallback chain: host surface first, mounted game surface second, `log(message)` last.
- `t(key, params)` uses the same locale source as current action-controller code and must not hardcode Chinese or English text in the descriptor.
- mini-game enters through the same App adapter because `frontend/minigame/game.js` mounts `CanvasGameApp`.
- mini-game load order must explicitly load both `CanvasActionDispatchRegistry` and `CanvasActionDispatcher`, or a test must prove the dispatcher require path loads the registry before `CanvasGameApp` constructs dispatcher instances.
- Consumers must call functions, not read optional values such as `context.tutorialController` directly.
- Panel files must not implement their own host-type checks or read `host.lastGame` directly after they are migrated to the context contract.
- `FamousPersonsPanel` may keep its current private `getUiStateOwner` helper only before the context migration slice touches it. After Slice 4, migrated panel lifecycle/action functions receive context-derived owner state and the private helper must be removed or reduced to a test-only compatibility shim.

Controller binding:

```js
CanvasActionController.prototype.getPanelActionContext = function getPanelActionContext() {
  return buildPanelActionContext(this.host);
};
```

Compatibility wrappers must call this method rather than constructing ad hoc context objects.

### 6.6 Async Panel-Affecting Commands

The following famous commands are not panel-local UI actions, but they affect the famous panel surface:

- `seekFamousPerson`
- `acceptFamousPerson`
- `dismissFamousPersonCandidate`
- `assignFamousAttributePoint`

Contract:

1. API command execution remains a game command in the first migration.
2. API result application keeps the current `applyApiState(result, { render: false })` behavior.
3. After success, the command uses the same modal dirty API as panel actions.
4. If the command currently reopens the famous panel, that reopen behavior is preserved by descriptor or command metadata.
5. If the user closes the panel before an async result returns, the command may update state but must only repaint modal if the contract says "reopen on success" or the panel is still open.
6. Failure repaints modal only when current UI state requires visible error/availability feedback; otherwise it logs without forcing a panel render.

Current famous async baseline:

| Command | Success baseline | Failure baseline | Tutorial side effect |
|---|---|---|---|
| `seekFamousPerson` | `applyApiState(result, { render:false })`, log success, reopen `famousPersons` | log failure, refresh famous panel surface | `onFamousPersonSought(result || {})` after success |
| `acceptFamousPerson` | `applyApiState(result, { render:false })`, log success, reopen `famousPersons` | log failure, refresh famous panel surface | none currently |
| `dismissFamousPersonCandidate` | `applyApiState(result, { render:false })`, log success, reopen `famousPersons` | log failure, refresh famous panel surface | none currently |
| `assignFamousAttributePoint` | `applyApiState(result, { render:false })`, reopen `famousPersons`, open detail for `personId`, log success, refresh famous panel surface | log failure, refresh famous panel surface | none currently |

The first root-cause loop may replace `openPanel()`/`refreshPanelSurface()` calls with descriptor and scheduler calls, but the visible success/failure/reopen/detail behavior above is the equivalence baseline.

### 6.7 Tooltip Commands

`showFamousSkillTooltip` and `clearFamousSkillTooltip` are modal-surface commands while `famousPersons` is open.

Contract:

- tooltip state remains owned by the renderer/surface state until the hit target pool refactor;
- tooltip show/clear marks `modal` dirty when `famousPersons` is open;
- tooltip show/clear falls back to the existing non-panel render path when the panel is not open;
- panel close clears tooltip through panel lifecycle;
- tooltip hit targets belong to the `modal` pool after Slice 7.

The current hardcoded `handleTap()` branches are temporary and must retire with the same gate as panel action dispatcher adoption.

### 6.8 Outside Click Contract

Outside-click/background hit targets are owned by modal projection once `projectModalLayer()` lands.

Rules:

- `CanvasPanelSurfaceManager.projectModalLayer()` adds the modal background target from panel metadata.
- The generated action shape is:

  ```js
  { type: 'panelOutsideClick', panelKey: 'famousPersons' }
  ```

- `panelOutsideClick` resolves through the same dispatcher/runner path as explicit close actions.
- If `closesOnOutsideClick` is `true`, the runner executes the panel close descriptor and marks `modal` dirty.
- If `closesOnOutsideClick` is `false`, the action returns `true` when `blocksBaseHitTargets` is `true`, and returns `false` only for explicitly pass-through overlays.
- Background hit targets use the lowest modal priority inside their band so panel-internal buttons and cards resolve first.
- During migration, existing panel-rendered background targets may remain only until modal projection owns the same behavior and hit-target equivalence tests pass.

### 6.9 Error Handling

Panel command execution is fail-closed:

- if descriptor resolution fails, return `false` and do not dirty any slot;
- if `open`/`close`/panel action throws after lifecycle entry, log the error, do not run post-action tutorial hooks, mark `modal` dirty, flush modal, and return `false`;
- if a `beforeOpen` hook vetoes, do not enter lifecycle, do not dirty, and return `false`;
- if panel render throws during modal projection, log the panel key and continue rendering remaining entries where possible;
- preserving the previous modal frame after render failure requires a back buffer. Without a back buffer, fail closed by clearing/reprojecting what can be safely rendered and recording the failure;
- scheduler dirty flags are cleared only after the relevant flush succeeds or records a handled failure.

Rollback is not required in the first slice because current panel actions mutate plain modal/UI state without transactions. Any new action that performs multi-step mutation must either be idempotent or provide its own rollback.

### 6.10 Observability and Retirement Gates

Temporary mechanisms must be observable while they exist.

Counters/log labels:

- `panelSurface.syncAfterBaseRender.count`
- `panelSurface.baseHitTargetsSnapshot.count`
- `panelAction.controllerWrapper.count`
- `panelAction.dispatcherFallback.count`
- `panelSurface.refreshAlias.count`

Counter rules:

- counters are added in the first implementation cycle before compatibility retirement begins;
- counters are enabled in tests and dev diagnostics only, not production by default;
- each counter increments at the compatibility boundary, not inside the replacement path;
- a compatibility path may be removed only when focused unit tests, integration tests, and static search all show that path is no longer used.

Removal gates:

| Temporary mechanism | Removal gate |
|---|---|
| `CanvasActionController` famous wrappers | Dispatcher-first famous actions pass App/Shell/mini-game tests and wrapper counter is zero in focused tests |
| `refreshPanelSurface(panelKey)` public alias | `projectModalLayer()` handles open-set projection and all callers either mark `modal` dirty or call scheduler flush |
| `baseHitTargetsByPanel` | named hit target pools are active and base frame tests prove modal targets survive base refresh |
| `syncOpenPanelSurfacesAfterBaseRender()` | named hit target pools are active, counter remains zero in focused render tests, and no production path depends on repair |
| hardcoded tooltip branches in App/Shell tap handlers | tooltip descriptors or modal command route covers show/clear behavior |

### 6.11 Frozen Export Signatures

These signatures are the integration contract for the first root-cause loop. Implementations may add private helpers, but changing these names, return shapes, or constructor arguments requires a spec update first.

```js
// frontend/js/platform/CanvasPanelActionRegistry.js
module.exports = {
  resolve(action), // -> descriptor | null
  has(action), // -> boolean
  supportedActions(), // -> string[]
  register(panelKey, descriptor), // tests/dev-only injection
};

// frontend/js/platform/CanvasPanelActionRunner.js
module.exports = class CanvasPanelActionRunner {
  constructor({ contextAdapter, scheduler, panelSurfaceManager, actionRegistry } = {}) {}
  run(action, context) {} // -> boolean
};

// frontend/js/platform/CanvasPanelActionContextAdapter.js
module.exports = function buildPanelActionContext(host) {
  // -> normalized context from Section 6.5
};

// frontend/js/platform/CanvasStageScheduler.js
module.exports = class CanvasStageScheduler {
  constructor({ host, panelSurfaceManager, log } = {}) {}
  markDirty(slot, reason, payload) {}
  flush(slots) {}
  flushAll() {}
  runAtomic(fn, options) {}
};
```

Required host/controller binding:

```js
CanvasActionController.prototype.getPanelActionContext = function getPanelActionContext() {
  return buildPanelActionContext(this.host);
};
```

`CanvasPanelActionRegistry.js` keeps the current filename for this loop, but it must be documented as a descriptor table. `frontend/js/platform/panels/CanvasPanelRegistry.js` remains the panel module/entry table.

### 6.12 Project Rule Governance

This spec does not require adding a root `AGENTS.md`.

Feedback recommending a new `AGENTS.md` is directionally useful only after a separate rule audit. Historical project rules have evolved since project start; some may still protect the repo, some may be obsolete, and some may now block the root-cause refactor. Do not copy old rules into a new project-level agent file as part of this loop.

If a future `AGENTS.md` is proposed, it must first classify each rule:

- keep: still prevents real repo damage or coordination failure;
- update: valid intent, stale wording or scope;
- retire: obsolete, duplicated, or now harmful;
- task-local: belongs in this refactor spec or implementation notes, not in permanent global rules.

The only rule-like constraints accepted by this spec are the local contracts above: single dispatch route, normalized context, scheduler-owned flush, projection-owned modal layer, hit target pools, and explicit compatibility removal gates.

## 7. Landing Plan

### Slice 0: Baseline and Spec Lock

Purpose: freeze behavior before routing changes.

Deliverables:

- this spec reviewed and approved;
- famous-persons tap/action behavior documented;
- current tests identified as behavior locks;
- a reproducible trace baseline for famous actions: handled booleans, callback order, dirty/flush slots, render calls, compatibility counters, and representative hit-target results.

Behavior locks:

- tutorial `canOpenTab('famousPersons') === false` must not mutate modal owner;
- opening famous persons resets game-owned famous panel state but not shell-local stale fields;
- closing famous persons triggers tutorial close/refresh behavior;
- detail/page actions redraw only panel overlay;
- async famous API actions reopen/refresh only the panel surface.

Freezes for next slice:

- baseline trace file shape and comparison command;
- expected famous action list and current App/Shell/mini-game entry points;
- current tutorial veto/open/close/detail callback order.

### Root-Cause Loop Acceptance Rule

Slices 1-8b below are the required target loop for the first implementation cycle. They may be implemented as separate commits for review, but the branch should not be considered architecturally complete until Slice 8b passes. A partial stop before Slice 8b is a temporary construction state, not a valid mainline destination.

### Slice 1: Panel Action Registry

Purpose: move famous action mapping out of controller switch bodies.

Add `frontend/js/platform/CanvasPanelActionRegistry.js` as a descriptor table only.
`CanvasActionDispatchRegistry` remains the single executable dispatch registry and delegates panel action descriptors to the panel runner.

Initial entries:

- `openFamousPersons`
- `closeFamousPersons`
- `openFamousPersonDetail`
- `closeFamousPersonDetail`
- `changeFamousPersonsPage`

The registry resolves an action into a panel command descriptor. It does not execute the command by itself.

Required cleanup in this slice:

- existing famous entries in `CanvasActionDispatchRegistry.RENDER_ACTIONS` must be removed or replaced by one descriptor delegation path, not duplicated;
- `CanvasActionDispatchRegistry.dispatch()` branch order must be `switchTab -> panel descriptor -> FINISH_ACTIONS -> RENDER_ACTIONS`;
- `supportedActions()` still reports famous action types from the single dispatch registry;
- tests must prove a famous action cannot execute through both dispatcher and controller fallback;
- Shell same-name famous methods must not be the dispatcher target for descriptor-backed famous actions.

Freezes for next slice:

- `CanvasPanelActionRegistry.resolve(action)` returns the descriptor shape from Section 6.1;
- `CanvasPanelActionRegistry.has(action)` and `supportedActions()` are stable;
- `CanvasActionDispatchRegistry.dispatch()` has the frozen panel descriptor branch position;
- the five famous actions have no live `RENDER_ACTIONS` execution branch.

### Slice 2: Panel Action Runner

Purpose: centralize execution of panel commands.

Add `CanvasPanelActionRunner` and `CanvasPanelActionContextAdapter`.

Responsibilities:

- execute generic descriptor hooks, including the famous tutorial open veto;
- call `manager.openPanel`, `manager.closePanel`, or `manager.runPanelAction`;
- trigger descriptor-declared tutorial callbacks in the same order as today;
- request modal refresh through scheduler/compat render hook;
- return the same handled boolean as current controller methods.

The existing `CanvasActionController.handle_*Famous*` methods become compatibility wrappers:

```js
handle_openFamousPersons(action) {
  return this.panelActionRunner.run(action, this.getPanelActionContext());
}
```

The wrapper must use `this.getPanelActionContext()` and must not construct context inline.

Freezes for next slice:

- `CanvasPanelActionRunner.run(action, context)` returns a handled boolean;
- `CanvasActionController.prototype.getPanelActionContext()` exists and calls `buildPanelActionContext(this.host)`;
- all famous controller handlers are wrappers only, with no tutorial/panel business logic left inside;
- disabled, veto feedback, and hook binding behavior match Section 6.1.

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

Slice 3 rules:

- modal flush is synchronous for handled user actions;
- explicit `runAtomic()` is required for intentional open+detail batching;
- no rAF coalescing for modal until Section 8 equivalence tests exist;
- `afterHandled()` compatibility may still render base, but it must not dirty/flush modal.

Freezes for next slice:

- `CanvasStageScheduler.markDirty('modal', reason, payload)` and `flush(['modal'])` are the modal refresh route;
- user-action modal flush is synchronous;
- manager compatibility methods may mark dirty but do not call scheduler `flush()` internally;
- `renderPanelCanvasAction` is no longer the intended user-action path for famous panel actions.

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
    renderPriority: 100,
    hitTargetPriority: 100,
    closesOnOutsideClick: true,
    blocksBaseHitTargets: true,
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

This slice is not complete until the entry shape contains all metadata from Section 6.2. Do not defer priority/outside-click/blocking fields to Slice 6.

Freezes for next slice:

- `CanvasPanelRegistry.get(panelKey)` returns the rich entry shape for `famousPersons`;
- `FamousPersonsPanel` exposes metadata-compatible lifecycle/action/render behavior;
- migrated panel lifecycle/action code receives owner/context through the adapter contract rather than private host-type guesses.

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

Required context adapter methods:

- `getState`
- `getPanelSurfaceManager`
- `getGameHost`
- `renderAction`
- `getScheduler`
- `getRuntimeScheduler`
- `getTutorialController`
- `showFloatingText`
- `log`

The dispatcher should not need to know whether it is running on App or Shell.

The first dispatcher-first adoption must cover App, Shell, and mini-game smoke tests. If mini-game lacks a full scheduler, the adapter must provide the same synchronous modal-flush compatibility behavior.

`frontend/minigame/game.js` must explicitly load the dispatch registry before App construction, or tests must prove `CanvasActionDispatcher` reliably loads it before any dispatcher instance is created.

Freezes for next slice:

- App/Shell/mini-game try dispatcher first for supported famous actions;
- fallback to `CanvasActionController` happens only when dispatcher cannot support the action, before side effects;
- dispatcher fallback counter is observable and zero for descriptor-backed famous actions in focused tests.

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

This is the point where the architecture can represent other panel entries, but the first root-cause loop still migrates only `famousPersons`. A second real panel waits until Slice 8b is green.

This slice is not complete until new code no longer calls `refreshPanelSurface(panelKey)` directly. Existing calls may remain only if they are listed against the removal gate in Section 6.10.

Freezes for next slice:

- `projectModalLayer()` projects the open modal set in band/priority order;
- outside-click/background target generation is projection-owned;
- `refreshPanelSurface(panelKey)` is only a compatibility alias counted by `panelSurface.refreshAlias.count`.

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

Slice 7 is a hit-target pool exclusive period. While it is active, parallel work that touches hit-target storage, hit-target resolution, panel surface rendering, or modal projection must pause or rebase onto the Slice 7 contract. The exclusive period ends only when the Slice 7 tests below are green.

Before removal, add focused tests that:

- count `syncOpenPanelSurfacesAfterBaseRender()` calls;
- prove a base render cannot erase modal hit targets;
- prove modal projection cannot erase guide hit targets once guide exists;
- compare pre/post hit target resolution for the famous panel.

Freezes for next slice:

- hit targets are stored in named `base`, `modal`, and `guide` pools;
- resolver order is `guide -> modal -> base`;
- `baseHitTargetsByPanel` and base-render repair are no longer needed for correctness.

### Slice 8a: Integration Equivalence Validation

Purpose: prove the slices work together before deleting compatibility code.

Deliverables:

- run the full Section 8 equivalence suite against the Slice 0 baseline;
- compare action trace, tutorial trace, render slot trace, async command trace, hit target matrix, outside-click matrix, mini-game smoke, and compatibility counters;
- record any mismatch as a fix against the responsible earlier slice;
- do not delete compatibility layers in 8a except dead code proven unreachable by tests and static search.

Freezes for next slice:

- baseline diff is green for `famousPersons`;
- compatibility counters identify only paths that are ready to delete;
- all App/Shell/mini-game famous actions route through dispatcher/runner.

### Slice 8b: Compatibility Retirement

Purpose: remove compatibility layers before wider panel migration.

Remove or fail tests on new use of:

- `CanvasActionController` famous wrappers;
- public `refreshPanelSurface(panelKey)` calls outside manager/scheduler tests;
- hardcoded famous tooltip branches in App/Shell tap handlers;
- `syncOpenPanelSurfacesAfterBaseRender()` and `baseHitTargetsByPanel` after Slice 7.

This is the minimum healthy stopping point before migrating more panels. Stopping at Slice 5, Slice 6, or Slice 8a is allowed only for a short-lived branch because it knowingly carries compatibility debt.

### Slice 9: PanelChrome and Wider Panel Migration

Purpose: reduce each panel file to content plus local actions.

Only after slices 1-8b are stable:

- introduce shared panel chrome;
- migrate settings/logs/advisor/taskCenter/etc. one at a time;
- keep each panel migration independently reviewable.

### Acceptable Stopping Points

| Stop point | Health | Allowed duration | Notes |
|---|---|---|---|
| After Slice 2 | Red/Yellow | construction checkpoint only | business logic moved, but scheduler and dispatcher-first are not active |
| After Slice 3 | Yellow | construction checkpoint only | modal dirty path exists, but runtime input still depends on controller |
| After Slice 5 | Orange | construction checkpoint only | dispatcher-first exists, but manager repair and compatibility wrappers still remain |
| After Slice 6 | Orange | construction checkpoint only | projection is better, but hit target repair still masks root conflict |
| After Slice 8a | Yellow/Green | construction checkpoint only | equivalence is proven, but compatibility layers still remain |
| After Slice 8b | Green | acceptable | famous route has single dispatch path, projection route, hit target pools, and compatibility cleanup |
| After Slice 9 | Green | target expansion state | ready for wider panel migration with PanelChrome |

If work must pause before Slice 8b, the branch should carry an explicit debt note listing remaining compatibility gates from Section 6.10.

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
2. tutorial veto returns false, shows the current complete-step feedback, and does not open/close/reset anything;
   - no panel lifecycle runs;
   - no close-on-open sweep runs;
   - no tooltip is cleared;
   - no modal dirty flag or render/flush is scheduled;
   - no after hook or next-tick refresh runs;
3. allowed open order remains:
   - `canOpenTab`
   - panel open
   - render/dirty modal
   - tutorial opened callback
   - highlight refresh
   - scheduled highlight refresh
4. close order remains compatible with current tests;
5. detail/page actions dirty only modal;
6. API actions `seek/accept/dismiss/assignAttribute` keep the per-command baseline from Section 6.6;
7. tooltip show/clear keeps panel-only refresh when panel is open;
8. no full-frame render is introduced for panel-only actions.

### Equivalence Tests

The migration must add behavior-level equivalence tests before changing flush timing or hit target pools.

Required equivalence coverage:

1. action sequence trace: same action list yields same handled booleans and same callback order;
2. tutorial trace: `canOpenTab`, `onFamousPersonsOpened`, `onFamousPersonsClosed`, detail-open hooks, and refresh calls happen in the same order/count;
3. render slot trace: panel-only actions dirty/flush `modal` and do not render `base`;
4. hit target matrix: famous panel background, back button, detail card, pager, tooltip clear, and outside click resolve to the same action before and after refactor;
5. async command trace: successful and failed seek/accept/dismiss/assign flows preserve the Section 6.6 reopen/refresh/detail/log behavior for each command;
6. mini-game smoke: minigame boot still loads action registry/dispatcher before App and can handle a famous action through the same adapter.
7. compatibility counter trace: retired paths report zero after Slice 8b;
8. hit target pool trace: base frame rebuild does not erase modal targets, modal projection does not erase guide targets, and resolver order is `guide -> modal -> base`;
9. outside-click matrix: `closesOnOutsideClick` and `blocksBaseHitTargets` combinations match Section 6.2 semantics for the famous panel and one synthetic pass-through fixture;
10. veto trace: close-on-open sweep counter, tooltip clear counter, dirty counter, render counter, after-hook counter, and next-tick refresh counter all remain zero on tutorial veto.

Pixel-level comparison is not required for Slice 1-3 because no visual code should change. It becomes useful only when modal projection or PanelChrome changes drawing order.

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
| Panel action descriptor and dispatch registry drift | Same action may map differently in two places | Dispatch registry is the only executable route; panel registry is descriptor-only |
| Context adapter hides wrong owner | Shell may mutate shell fields instead of mounted game fields | Adapter tests must assert current `getUiStateOwner()` behavior |
| Compatibility layer persists | Temporary route becomes permanent architecture | Section 6.10 removal gates and Slice 8b retirement |
| rAF coalescing changes hit target timing | Tutorial target lookup may run before modal targets exist | Start with synchronous modal flush; require equivalence tests before rAF |

## 10. Review Decisions

Closed by this revision:

1. `CanvasPanelActionRegistry` is a new descriptor table, but `CanvasActionDispatchRegistry` remains the only executable dispatch registry.
2. Slice 1-4 keep `CanvasActionController` as the runtime entry through compatibility wrappers. Dispatcher-first adoption starts in Slice 5.
3. Slice 3 modal flush is synchronous. rAF coalescing is a later optimization behind equivalence tests.
4. `refreshPanelSurface(panelKey)` remains only as a compatibility alias and must retire through Slice 8b gates.
5. The panel descriptor branch order is `switchTab -> panel descriptor -> FINISH_ACTIONS -> RENDER_ACTIONS`.
6. The five famous `RENDER_ACTIONS` entries retire when the descriptor branch lands.
7. Shell same-name famous methods may not remain a divergent dispatcher target.
8. Veto feedback is distinct from disabled handling: disabled returns handled with no mutation or feedback; tutorial veto returns `false` and shows the current complete-step feedback.
9. `CanvasPanelActionRegistry.js` keeps its name for this loop, but it is explicitly descriptor-only and must be documented apart from `panels/CanvasPanelRegistry.js`.
10. Slice 8 is split into 8a integration equivalence validation and 8b compatibility retirement.
11. Slice 7 is a hit-target pool exclusive period.
12. A new root `AGENTS.md` is not part of this loop. Any future `AGENTS.md` requires a separate rule audit first.
13. The recommendation that disabled be handled only in `PanelActionRunner.run()` is rejected. Disabled must short-circuit at the earliest unified action entry, with a defensive runner check while compatibility paths exist.

Implementation defaults accepted for the first loop:

- first loop migrates only `famousPersons`;
- no second panel is selected by this spec. `settings` remains a candidate only after Slice 8b is complete;
- compatibility counters are enabled in tests/dev diagnostics and are production-silent by default;
- runtime counter logs require an explicit opt-in debug flag.

## 11. Recommended First Implementation Batch

Recommended first implementation cycle:

```text
Root-cause loop: Slice 1 through Slice 8b for famousPersons
```

Files likely touched:

- `frontend/js/platform/CanvasPanelActionRegistry.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/platform/CanvasPanelActionContextAdapter.js`
- `frontend/js/platform/CanvasStageScheduler.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasActionDispatchRegistry.js`
- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasPanelSurfaceManager.js`
- `frontend/js/platform/HitTargetManager.js`
- `frontend/js/platform/panels/CanvasPanelRegistry.js`
- `frontend/js/platform/panels/FamousPersonsPanel.js`
- App/Shell tap handling sites that currently special-case famous tooltip/panel actions
- `frontend/js/platform/CanvasActionDispatcher.test.js`
- `frontend/js/platform/CanvasActionControllerFamous.test.js`
- `frontend/js/platform/CanvasStageScheduler.test.js`
- new focused tests for registry/runner/context adapter
- hit target pool and modal projection tests

Expected outcome:

- no user-visible behavior change for famous persons;
- famous-person action business logic moves out of `CanvasActionController`;
- controller famous handlers are retired by Slice 8b, not left as wrappers;
- dispatch registry has one famous-panel execution path;
- context adapter proves App/Shell/mini-game owner resolution;
- scheduler owns modal dirty/flush;
- manager projects modal layer from registry open state;
- named hit target pools remove panel/base collision repair;
- compatibility counters for retired paths are zero in focused tests.

This cycle is intentionally larger than the first draft. It avoids leaving the repo in a half-migrated state where controller wrappers, manager repair logic, and hit-target collisions remain alive together.
