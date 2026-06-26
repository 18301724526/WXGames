# Frontend ECS Batch 8A (Naming Mirror Removal) - 2026-06-25

## Status

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Batch          | `8. Bridge Retirement`                                   |
| Slice          | `8A (naming mirror removal)`                             |
| State          | `Ready for Migration Owner Review`                       |
| Removed mirror | App/Shell `this.naming`                                  |
| Snapshot path  | `getRendererSnapshot().modal['modal:naming']`            |
| Guard          | `scripts/check-frontend-ecs-naming-mirror-retirement.js` |
| Last updated   | `2026-06-26 18:19:04 +08:00`                             |

## Decision

Batch 8A removes the App/Shell `this.naming` mirror and retires the
naming-specific bridge wrappers. `modal:naming` remains owned by `ModalWorld`;
runtime reads are now snapshot-derived through `CanvasModalSnapshotAdapter`.

This slice only removes the naming mirror. Other modal/panel mirrors
(`confirmDialog`, `rewardReveal`, `activeEventId`, targetPicker
`territoryUiState`, and blockingPanel `show*` mirrors) remain for later Bridge
Retirement slices.

## Removed Mirror Surface

- Deleted App constructor initialization of `this.naming`.
- Deleted Shell constructor initialization of `this.naming`.
- Removed App-to-Shell `canvasShell.naming` sync from naming open/input/submit and
  render paths.
- Removed Shell/App naming UI reads and writes of `this.naming`.
- Removed input-router blocking overlay reads of `this.naming.visible`.
- Removed tutorial naming reads of `game.naming` / `canvasShell.naming`.
- Removed `openNamingModal`, `closeNamingOwner`, and `updateNamingPayload` from
  `CanvasModeOwnershipBridge.js`.

Production App/Shell/tutorial/input code no longer contains App/Shell naming
mirror access. Remaining `naming` strings are renderer option names, i18n keys,
tests, docs, or `modal:naming` owner/snapshot identifiers.

## Snapshot Replacement

- `CanvasModalSnapshotAdapter.js` exposes snapshot helpers for
  `snapshot.modal['modal:naming']`.
- App and Shell naming open/update/close call `openNamingSnapshot`,
  `updateNamingSnapshot`, and `closeNamingSnapshot`, which route to the generic
  modal owner API.
- Shell input can update a naming modal opened by App: the adapter finds the
  host whose `modal:naming` owner entry is open, then updates that owner.
- App/Shell render options pass `naming` only from the snapshot-derived payload.
- Tutorial checks use `game.getNamingSnapshot()` and `game.getNamingInputValue()`
  instead of mirror fields.

## Guard Upgrade

`scripts/check-frontend-ecs-naming-mirror-retirement.js` is a blocking guard. It
forbids production App/Shell-style naming mirror accesses such as
`this.naming`, `canvasShell.naming`, `game.naming`, `host.naming`,
`lastGame.naming`, and `shell.naming`, and it forbids the retired wrapper names:

- `openNamingModal`
- `closeNamingOwner`
- `updateNamingPayload`

The guard strips string literals before scanning so i18n keys such as
`'shell.naming.title'` remain allowed. Renderer option payloads such as
`options.naming` are also allowed because they are not App/Shell mirrors.

## Verification Packet

Executed before Ready for Migration Owner Review:

- `node --test frontend/js/platform/CanvasModalSnapshotAdapter.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/GameCommandService.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasGameApp.test.js scripts/check-frontend-ecs-naming-mirror-retirement.test.js scripts/check-frontend-ecs-mode-ownership-spine.test.js scripts/rewrite-frontend-asset-version.test.js`
  (157 tests)
- `node scripts/check-frontend-ecs-naming-mirror-retirement.js` (0
  violations)
- `node scripts/check-frontend-ecs-renderer-snapshot-boundary.js` (0
  violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `node scripts/check-frontend-ecs-input-intent-spine.js` (0 violations)
- `node scripts/check-frontend-ecs-battle-domain-owner.js` (0 violations)
- `node scripts/check-frontend-ecs-blocking-panel-ownership.js` (0 violations)
- `node scripts/check-frontend-ecs-target-picker-ownership.js` (0 violations)
- `node scripts/check-frontend-script-manifest.js`
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1240 tests)
- `git diff --check`

## Review Evidence

- Mirror deletion confirmation: production App/Shell code has no `this.naming`,
  `canvasShell.naming`, `game.naming`, `host.naming`, `lastGame.naming`, or
  `shell.naming` references.
- Snapshot replacement evidence:
  - `CanvasGameAppRenderingRuntime.js` and `CanvasGameShellRenderingRuntime.js`
    pass `naming: snapshotNaming`.
  - `CanvasGameAppGuideUi.js` and `CanvasGameShellSystemUi.js` use
    `getNamingSnapshot`, `openNamingSnapshot`, `updateNamingSnapshot`, and
    `closeNamingSnapshot`.
  - `TutorialGuideController.js` reads naming prompt/input through the snapshot
    helpers.
- Bridge wrapper deletion evidence: `CanvasModeOwnershipBridge.js` exposes only
  the generic modal APIs for naming; naming-specific wrappers are absent.
- Guard evidence: the new naming retirement guard reports 0 violations and is
  wired into `scripts/run-architecture-smoke.js`.

## Next Slice Candidate

After 8A sign-off, continue Bridge Retirement one modal at a time. Recommended
next target remains `confirmDialog` because it is the next sealed modal, but its
callback registry and reset continuation make it higher risk than naming.
