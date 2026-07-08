# Button Scheduler Manager Panel Slice 0 Baseline

Date: 2026-07-09
Worktree: `F:/AI Project/WXGamesLocal-button-scheduler-root-cause`
Branch: `codex/button-scheduler-panel-root-cause`
Base commit: `96ea25b519df8e3f34992ef8ae6a6eff1a499544`

## Focus Command

```powershell
node --test frontend/js/platform/CanvasActionDispatcher.test.js frontend/js/platform/CanvasFamousActionHandlers.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js
```

Result: 98 passed, 0 failed.

## Behavior Locks

- Disabled actions return handled without mutation.
- Current famous open/close compatibility handlers sync host and mounted game state, clear famous tooltip, and run tutorial open/close/refresh callbacks.
- Famous detail and page actions clear tooltip and redraw through the current render path.
- Famous async commands are game commands and report tutorial seek success through `onFamousPersonSought`.
- Browser entrypoint loads `CanvasFamousActionHandlers.js` before `CanvasActionController.js`; mini-game does the same through `require`.

## Current Gaps Against Target Spec

- The `main` baseline does not yet contain `CanvasPanelSurfaceManager`, `CanvasPanelRegistry`, `FamousPersonsPanel`, `CanvasPanelActionRegistry`, `CanvasPanelActionRunner`, `CanvasPanelActionContextAdapter`, or `CanvasStageScheduler`.
- Famous rendering is still inline in `CanvasFrameRenderer` and `HudOverlayCanvasRenderer` when `showFamousPersons` is true.
- App/Shell tap routing still calls `CanvasActionController.handle()` directly for ordinary hit targets.
- Famous tooltip actions are hardcoded in App/Shell tap handlers.

