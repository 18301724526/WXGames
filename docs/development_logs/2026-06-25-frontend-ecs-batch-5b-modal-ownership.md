# Frontend ECS Batch 5 Slice 5b (Panel/Modal Ownership: event + rewardReveal) - 2026-06-25

## Status

| Field            | Value                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Batch            | `5. Panel/Modal Ownership`                                                               |
| Slice            | `5b (rewardReveal + event sealed)`                                                       |
| State            | `Completed`                                                                              |
| ECS modal owner  | `frontend/js/ecs/mode/ModalWorld.js` (reused)                                            |
| Bridge surface   | `openRewardRevealModal` / `closeRewardRevealOwner`; `openEventModal` / `closeEventOwner` |
| Seal enforced by | existing `check-frontend-ecs-mode-ownership-spine.js`                                    |
| Last updated     | `2026-06-26 13:59:23 +08:00`                                                             |

## Decision

Slice 5b seals the `event` (legacy field `activeEventId`) and `rewardReveal` modals.
The map showed these are far more distributed than the slice-5a subtypes (`event`
is written across ~19 files, `rewardReveal` across ~6), so the migration owner
approved splitting 5b into **rewardReveal first, then event**. This document records
the **rewardReveal** sealing and the **event lighter** sealing for review.

- `rewardReveal` is **pure presentation** (the only affordance is a close button via
  the existing `closeRewardReveal` action), so it needs **no callbacks** — two bridge
  wrappers suffice: `openRewardRevealModal(state)` and `closeRewardRevealOwner()`. The
  `'modal:rewardReveal'` literal + the legacy `{...this.rewardReveal}` fallback live
  only in the approved bridge path.
- The eight `rewardReveal` write sites across six files now route through the owner,
  each as a single owner-routed line so the legacy field stays the owner-derived
  mirror and the mode-ownership-spine guard's per-(file,symbol) count does not grow:
  - `CanvasGameShellSystemUi.showRewardReveal` (open, `createdAt` still stamped before
    handing to the owner) + `closeRewardReveal` (owner-close before `this.rewardReveal = null`)
  - `CanvasGameAppCommands.claimTaskReward` (App open; the multi-line object collapsed
    to one line, dropping the per-file count 5 -> 4)
  - `CanvasCityActionHandlers` `afterEventClaimed` (host open) and `claimTaskRewardDirect`
    (a conditional open-or-close in ONE statement: payload -> owner open, else owner
    close + null)
  - `CanvasShellActionHandlers.handle_closeRewardReveal` (close fallback, comma-expression
    with owner-close)
  - `CanvasGameShellCommands` + `CanvasGameAppRenderingRuntime` reset paths (owner-close
    before the field null)
- Readers stay on the mirror, unchanged (renderer `renderRewardReveal`, the
  rendering-runtime render options, input-router blocking checks, the tutorial gate,
  and the bridge `collectModalKeys`). Reader migration to the snapshot is Batch 6.
- `event` is sealed through the lighter design: only canonical
  `handle_openEvent` / `handle_closeEvent` and central `closePanels` route through
  the owner. The bridge owns `openEventModal(eventId)` and `closeEventOwner()`,
  with host/game/canvasShell mirror sync encapsulated inside the approved bridge
  path. Scattered navigation/tutorial/reset `activeEventId = null` calls remain
  legacy mirror clears for this sub-step.
- `EventController.activeEventId` is not part of the modal owner. The event modal
  payload stores `{ eventId }`, while `EventController.activeEventId` stays its
  isolated claim cursor managed by `EventController.open()` / `close()`.

## Scope Control

Slice 5b-event does not:

- rewrite every scattered `activeEventId = null` navigation/tutorial/reset clear;
  they remain legacy mirror clearing until a later snapshot/read-side pass
- touch `naming`/`confirmDialog` (sealed in slice 5a) or `targetPicker`/`blockingPanel`
  (slices 5c/5d)
- migrate renderer/tutorial/input-router reads off the legacy mirror (Batch 6)

## Acceptance Answers

| Question                          | Answer                                                                                                                                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old owner being retired?          | `rewardReveal` source-of-truth across Shell/App/handler fields and canonical `activeEventId` open/close/central-close writes. Both now route through the ECS modal owner; legacy fields remain mirrors.                                              |
| New ECS owner?                    | `frontend/js/ecs/mode/ModalWorld.js` (reused), via `CanvasModeOwnershipBridge` rewardReveal wrappers plus `openEventModal` / `closeEventOwner`.                                                                                                      |
| Legacy fields/methods remaining?  | `this.rewardReveal`, `this.host.rewardReveal`, and `activeEventId` on host/game/canvasShell remain renderer/tutorial/input-router-facing mirrors. Scattered `activeEventId = null` clears remain legacy mirror clearing for this lighter event pass. |
| Guard preventing old-path growth? | The existing `check-frontend-ecs-mode-ownership-spine.js` (sealed subtype references may not grow beyond baseline); no new guard file.                                                                                                               |
| Behavior tests?                   | Bridge rewardReveal/event wrapper tests plus focused CanvasActionController event open/close/central-close coverage and existing City/Shell/command/tutorial tests.                                                                                  |
| Rollback?                         | Restore rewardReveal write sites and canonical event open/close/central-close paths to direct legacy field writes, and drop the rewardReveal/event bridge wrappers.                                                                                  |
| Next subtype to seal?             | `targetPicker` (5c), then `blockingPanel` (5d), after migration owner review signs off this 5b implementation.                                                                                                                                       |

## Verification

Local verification passed:

- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/CanvasCityActionHandlers.test.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations; legacy findings remain at/below the 0A baseline)
- `npm run lint` (exit 0; no new suppressions)
- `npm run format:check`
- `npm run test:architecture` passed with `1189` tests and all architecture guards
- `git diff --check`

The event lighter pass keeps behavior scoped to canonical event open/close and central panel close: bridge tests cover event payload + host/game/canvasShell mirror sync and `EventController` claim-cursor isolation; action-controller tests cover owner-routed open/close and central closePanels owner-close routing.

## Review Result

`event` sealing is `Completed` after migration owner sign-off on `2026-06-26 13:59:23 +08:00`. The review accepted the approved lighter design implementation: bridge wrappers, canonical open/close routing, central closePanels owner-close routing, host/game/canvasShell mirror sync, scattered legacy mirror clear scope, and `EventController.activeEventId` claim-cursor isolation. Implementation commit `58a77bbf` was pushed to `origin/codex/refactor-tutorial-guide-architecture`; slices 5c/5d remain gated behind their own sealed slices.
