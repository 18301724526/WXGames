# Frontend ECS Batch 8B (ConfirmDialog Mirror Removal) - 2026-06-25

## Status

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Batch          | `8. Bridge Retirement`                                           |
| Slice          | `8B (confirmDialog mirror removal)`                              |
| State          | `Ready for Migration Owner Review`                               |
| Removed mirror | App/Shell `this.confirmDialog`                                   |
| Snapshot path  | `getRendererSnapshot().modal['modal:confirmDialog']`             |
| Guard          | `scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js` |
| Last updated   | `2026-06-26 18:39:03 +08:00`                                     |

## Decision

Batch 8B removes the App/Shell `this.confirmDialog` mirror and retires the
confirmDialog-specific bridge wrappers. `modal:confirmDialog` remains owned by
`ModalWorld`; runtime reads are now snapshot-derived through
`CanvasModalSnapshotAdapter`.

Callback storage stays in the existing generic `ModalCallbackRegistry`. This
slice removes only the confirmDialog-specific convenience wrappers; it does not
remove generic `openModal`, `updateModalPayload`, `closeModal`, or
`resolveModalCallback`.

## Removed Mirror Surface

- Deleted Shell constructor initialization of `this.confirmDialog`.
- Removed Shell confirm dialog open/close/submitting writes to
  `this.confirmDialog`.
- Removed App/Shell render options reads of `this.confirmDialog` and
  `canvasShell.confirmDialog`.
- Removed App/Shell input-router blocking overlay reads of
  `this.confirmDialog.visible`.
- Removed Shell action handler reset-confirm reads of `uiHost.confirmDialog`.
- Removed `openConfirmDialogModal`, `closeConfirmDialogOwner`,
  `updateConfirmDialogPayload`, and `resolveConfirmDialogCallback` from
  `CanvasModeOwnershipBridge.js`.

Production App/Shell/tutorial/input code no longer contains App/Shell
confirmDialog mirror access. Remaining `confirmDialog` strings are renderer
option names, `modal:confirmDialog` owner/snapshot identifiers, generic helper
names, tests, docs, or renderer consumer option fields.

## Snapshot Replacement

- `CanvasModalSnapshotAdapter.js` exposes confirmDialog helpers for
  `snapshot.modal['modal:confirmDialog']`.
- Shell confirm dialog open/update/close calls `openConfirmDialogSnapshot`,
  `updateConfirmDialogSnapshot`, and `closeConfirmDialogSnapshot`, which route
  to the generic modal owner API.
- Shell action handlers call `getConfirmDialogSnapshot()` for reset kind/source
  and `resolveConfirmDialogSnapshotCallback()` for callbacks.
- App/Shell render options pass `confirmDialog` only from the snapshot-derived
  payload.
- App/Shell input routers use `isConfirmDialogSnapshotOpen()` for blocking
  overlay checks.

## Guard Upgrade

`scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js` is a blocking
guard. It forbids production App/Shell-style confirmDialog mirror accesses such
as `this.confirmDialog`, `canvasShell.confirmDialog`, `game.confirmDialog`,
`host.confirmDialog`, `lastGame.confirmDialog`, `shell.confirmDialog`, and
`uiHost.confirmDialog`, and it forbids the retired wrapper names:

- `openConfirmDialogModal`
- `closeConfirmDialogOwner`
- `updateConfirmDialogPayload`
- `resolveConfirmDialogCallback`

Renderer option payloads such as `options.confirmDialog` and snapshot paths such
as `snapshot.modal['modal:confirmDialog']` remain allowed because they are not
App/Shell mirrors.

## Verification Packet

Executed before Ready for Migration Owner Review:

- `node --test frontend/js/platform/CanvasModalSnapshotAdapter.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/GameCommandService.test.js frontend/js/tutorial/TutorialGuideController.test.js scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.test.js scripts/check-frontend-ecs-naming-mirror-retirement.test.js scripts/check-frontend-ecs-mode-ownership-spine.test.js`
  (173 tests)
- `node scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js` (0
  violations)
- `node scripts/check-frontend-ecs-naming-mirror-retirement.js` (0 violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `node scripts/check-frontend-ecs-renderer-snapshot-boundary.js` (0
  violations)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1248 tests)
- `git diff --check`

## Review Evidence

- Mirror deletion confirmation: production App/Shell code has no
  `this.confirmDialog`, `canvasShell.confirmDialog`, `game.confirmDialog`,
  `host.confirmDialog`, `lastGame.confirmDialog`, `shell.confirmDialog`, or
  `uiHost.confirmDialog` references.
- Snapshot replacement evidence:
  - `CanvasGameAppRenderingRuntime.js` and `CanvasGameShellRenderingRuntime.js`
    pass `confirmDialog: snapshotConfirmDialog`.
  - `CanvasGameShellSystemUi.js` uses `openConfirmDialogSnapshot`,
    `updateConfirmDialogSnapshot`, and `closeConfirmDialogSnapshot`.
  - `CanvasShellActionHandlers.js` uses `getConfirmDialogSnapshot()` and
    `resolveConfirmDialogSnapshotCallback()`.
  - App/Shell input routers use `isConfirmDialogSnapshotOpen()`.
- Bridge wrapper deletion evidence: `CanvasModeOwnershipBridge.js` exposes only
  the generic modal APIs for confirmDialog; confirmDialog-specific wrappers are
  absent.
- Guard evidence: the new confirmDialog retirement guard reports 0 violations
  and is wired into `scripts/run-architecture-smoke.js`.

## Next Slice Candidate

After 8B sign-off, continue Bridge Retirement one modal at a time. Recommended
next target remains `rewardReveal` because it is pure presentation and has no
callback registry behavior.
