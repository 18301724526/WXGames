# Frontend ECS Batch 5 Slice 5b (Panel/Modal Ownership: event + rewardReveal) - 2026-06-25

## Status

| Field            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| Batch            | `5. Panel/Modal Ownership`                            |
| Slice            | `5b (rewardReveal sealed; event next sub-step)`       |
| State            | `rewardReveal Ready for Migration Owner Review`       |
| ECS modal owner  | `frontend/js/ecs/mode/ModalWorld.js` (reused)         |
| Bridge surface   | `openRewardRevealModal` / `closeRewardRevealOwner`    |
| Seal enforced by | existing `check-frontend-ecs-mode-ownership-spine.js` |
| Last updated     | `2026-06-26 04:30:14 +08:00`                          |

## Decision

Slice 5b seals the `event` (legacy field `activeEventId`) and `rewardReveal` modals.
The map showed these are far more distributed than the slice-5a subtypes (`event`
is written across ~19 files, `rewardReveal` across ~6), so the migration owner
approved splitting 5b into **rewardReveal first, then event**. This document records
the **rewardReveal** sealing (this round); `event` is the next sub-step.

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

## Scope Control

Slice 5b-rewardReveal does not:

- seal `event` (`activeEventId`) — the next sub-step (~19 files; the `EventController`
  has its own same-named `activeEventId` claim cursor that must NOT be routed through
  the modal owner)
- touch `naming`/`confirmDialog` (sealed in slice 5a) or `targetPicker`/`blockingPanel`
  (slices 5c/5d)
- migrate renderer/tutorial/input-router reads off the legacy mirror (Batch 6)

## Acceptance Answers

| Question                          | Answer                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Old owner being retired?          | `rewardReveal` source-of-truth across Shell/App/handler fields; writes now route through the ECS modal owner, the field is a mirror. |
| New ECS owner?                    | `frontend/js/ecs/mode/ModalWorld.js` (reused), via `CanvasModeOwnershipBridge` rewardReveal wrappers.                                |
| Legacy fields/methods remaining?  | `this.rewardReveal` / `this.host.rewardReveal` remain as the renderer/tutorial/input-router-facing mirror.                           |
| Guard preventing old-path growth? | The existing `check-frontend-ecs-mode-ownership-spine.js` (rewardReveal may not grow beyond baseline); no new guard file.            |
| Behavior tests?                   | Bridge rewardReveal wrapper test + the existing City/Shell/command/tutorial tests that assert rewardReveal payloads.                 |
| Rollback?                         | Restore the eight write sites to direct `rewardReveal = …` assignments and drop the two wrappers.                                    |
| Next subtype to seal?             | `event` (`activeEventId`) — the 5b second sub-step; then `targetPicker` (5c), `blockingPanel` (5d).                                  |

## Verification

Local verification passed:

- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js` (rewardReveal wrapper test)
- `node --test frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/GameCommandService.test.js frontend/js/tutorial/TutorialGuideController.test.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations; rewardReveal counts at/below the 0A baseline)
- `npm run lint` (exit 0; no new suppressions)
- `npm run format:check`
- `npm run test:architecture` passed with `1187` tests and all architecture guards
- `git diff --check`

A three-lens adversarial review (behavior across the distributed write sites, seal/mirror/no-shadowing, scope/guard/purity) returned all three lenses clean.

## Review Result

`rewardReveal` sealing is `Ready for Migration Owner Review`. It must not be marked
`Completed` until migration owner review confirms the owner-sourced state, the two
bridge wrappers (no shadowing), the eight single-line owner-routed write sites, and
that the seal is enforced by the existing mode-ownership-spine guard. The `event`
sub-step and slices 5c/5d remain gated behind their own sealed slices.
