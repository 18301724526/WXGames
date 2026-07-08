# Frontend ECS Batch 8C (RewardReveal Mirror Removal) - 2026-06-25

## Status

| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| Batch          | `8. Bridge Retirement`                                         |
| Slice          | `8C (rewardReveal mirror removal)`                             |
| State          | `Ready for Migration Owner Review`                             |
| Removed mirror | App/Shell `this.rewardReveal`                                  |
| Snapshot path  | `getRendererSnapshot().modal['modal:rewardReveal']`            |
| Guard          | `scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js` |
| Last updated   | `2026-06-26 21:03:46 +08:00`                                   |

## Decision

Batch 8C removes the App/Shell `this.rewardReveal` mirror and retires the
rewardReveal-specific bridge wrappers. `modal:rewardReveal` remains owned by
`ModalWorld`; runtime reads are now snapshot-derived through
`CanvasModalSnapshotAdapter`.

`rewardReveal` is pure presentation (its only affordance is a close button via
the existing `closeRewardReveal` action), so unlike confirmDialog it needs no
callback registry wiring — the snapshot adapter exposes only open/close/read
helpers. This slice removes only the rewardReveal-specific convenience wrappers;
it does not remove generic `openModal`, `updateModalPayload`, or `closeModal`.

## Removed Mirror Surface

- Deleted App and Shell constructor initialization of `this.rewardReveal`.
- Removed Shell `showRewardReveal`/`closeRewardReveal` and the float-timer
  keep-alive writes/reads of `this.rewardReveal`.
- Removed App `claimTaskReward` and City action handler
  (`afterEventClaimed`, `claimTaskRewardDirect`) writes to
  `this.rewardReveal` / `this.host.rewardReveal`.
- Removed Shell action handler close-fallback and the Shell/App reset-path
  writes of `this.rewardReveal`.
- Removed App/Shell render-options reads of `this.rewardReveal`.
- Removed App/Shell input-router blocking-overlay reads and the Shell tutorial
  gate read of `this.rewardReveal`.
- Removed `TutorialGuideController` reads of `game.rewardReveal` /
  `canvasShell.rewardReveal`.
- Removed `openRewardRevealModal` and `closeRewardRevealOwner` from
  `CanvasModeOwnershipBridge.js`.

Production App/Shell/tutorial/input code no longer contains App/Shell
rewardReveal mirror access. Remaining `rewardReveal` strings are renderer option
names (`options.rewardReveal`), the API result field (`result.rewardReveal`),
the `modal:rewardReveal` owner/snapshot identifier, snapshot-adapter helper
names, tests, or docs.

## Snapshot Replacement

- `CanvasModalSnapshotAdapter.js` exposes rewardReveal helpers for
  `snapshot.modal['modal:rewardReveal']`: `openRewardRevealSnapshot`,
  `closeRewardRevealSnapshot`, `getRewardRevealSnapshot`,
  `getRewardRevealSnapshotFromRendererSnapshot`, and `isRewardRevealSnapshotOpen`.
- Shell/App open and close calls route through `openRewardRevealSnapshot` /
  `closeRewardRevealSnapshot`, which call the generic modal owner API and rebuild
  the renderer snapshot synchronously (so the immediately-following float-timer
  and blocking reads observe the new state).
- App/Shell render options pass `rewardReveal` only from the snapshot-derived
  payload (`snapshotRewardReveal`). The snapshot helper injects `visible: true`
  into the returned payload and returns `null` when closed, so renderers (which
  draw on a non-null reveal) keep working unchanged.
- App/Shell input routers and the Shell tutorial gate use
  `isRewardRevealSnapshotOpen()`; `TutorialGuideController.isRewardRevealOpen`
  uses `this.game?.isRewardRevealSnapshotOpen?.()`.
- Bridge `collectModalKeys` and `hasBlockingOverlayExceptTechTree` use
  `isAnyModalOpen(host, 'modal:rewardReveal')`.

## Guard Upgrade

`scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js` is a blocking
guard. It forbids production App/Shell-style rewardReveal mirror accesses such as
`this.rewardReveal`, `canvasShell.rewardReveal`, `game.rewardReveal`,
`host.rewardReveal`, `lastGame.rewardReveal`, `shell.rewardReveal`, and
`uiHost.rewardReveal`, and it forbids the retired wrapper names:

- `openRewardRevealModal`
- `closeRewardRevealOwner`

Renderer option payloads such as `options.rewardReveal`, the API result field
`result.rewardReveal`, and snapshot paths such as
`snapshot.modal['modal:rewardReveal']` remain allowed because they are not
App/Shell mirrors.

## Verification Packet

Executed before Ready for Migration Owner Review:

- `node --test scripts/check-frontend-ecs-rewardreveal-mirror-retirement.test.js frontend/js/platform/CanvasModalSnapshotAdapter.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/tutorial/TutorialGuideController.test.js`
  (117 tests)
- `node scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js` (0
  violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1254 tests)
- `git diff --check`

A three-lens adversarial review (behavior preservation, seal completeness / no
stale mirror, scope + guard integrity) was run on the diff.

## Review Evidence

- Mirror deletion confirmation: the report-only owner scan classifies
  `rewardReveal` as `24 (read=24)` — every remaining finding is a snapshot/adapter
  read; there are no App/Shell mirror writes.
- Snapshot replacement evidence:
  - `CanvasGameAppRenderingRuntime.js` and `CanvasGameShellRenderingRuntime.js`
    pass `rewardReveal: snapshotRewardReveal`.
  - `CanvasGameShellSystemUi.js` uses `openRewardRevealSnapshot`,
    `closeRewardRevealSnapshot`, and `isRewardRevealSnapshotOpen`.
  - App/Shell input routers and the Shell tutorial gate use
    `isRewardRevealSnapshotOpen()`.
- Bridge wrapper deletion evidence: `CanvasModeOwnershipBridge.js` no longer
  exposes `openRewardRevealModal` / `closeRewardRevealOwner`; the event wrappers
  are untouched.
- Guard evidence: the new rewardReveal retirement guard reports 0 violations and
  is wired into `scripts/run-architecture-smoke.js`.

## Next Slice Candidate

After 8C sign-off, continue Bridge Retirement one modal at a time. The remaining
heavier targets are `event` (`activeEventId`, distributed across ~19 files, with
`EventController`'s own same-named claim cursor that must stay out of scope) and
the `targetPicker` / `blockingPanel` modal subtypes.
