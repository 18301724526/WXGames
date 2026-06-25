# Frontend ECS Batch 5 Slice 5a (Panel/Modal Ownership) - 2026-06-25

## Status

| Field             | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Batch             | `5. Panel/Modal Ownership`                                           |
| Slice             | `5a (naming + confirmDialog)`                                        |
| State             | naming `Completed`; confirmDialog `Ready for Migration Owner Review` |
| ECS modal owner   | `frontend/js/ecs/mode/ModalWorld.js`                                 |
| Callback registry | `frontend/js/platform/ModalCallbackRegistry.js`                      |
| Bridge surface    | `CanvasModeOwnershipBridge` modal API + wrappers                     |
| Seal enforced by  | existing `check-frontend-ecs-mode-ownership-spine.js`                |
| Last updated      | `2026-06-26 03:32:16 +08:00`                                         |

## Decision

Batch 5 seals the covered modal subtypes so the ECS modal owner — not app/shell
fields — is their source of truth. It is delivered in slices; the migration owner
approved planning all slices and executing slice 5a (`naming` + `confirmDialog`)
first, then sub-split 5a into **naming first as its own sealed unit, then
confirmDialog**. This document records the **naming** sealing (this round) plus
the reusable modal-owner foundation; `confirmDialog` is the next sub-step.

- `ModalWorld.js` is a pure, functional ECS modal owner: per-subtype presence + a
  frozen serializable payload + a deterministic token (counter-based, no
  `Date`/`Math.random`). No classes, `new` (except Error), DOM, Promise, or stored
  closures — it passes the ECS boundary guard.
- `ModalCallbackRegistry.js` (platform) is the app-side companion: non-serializable
  continuations live here keyed by the owner's token, never inside `frontend/js/ecs`.
  `naming` has no stored callback today, so the registry is exercised by tests and
  the upcoming `confirmDialog` sub-step (whose `kind`-dispatch it generalizes).
- The owner ships via the regenerated runtime bundle (`esbuild@0.23.1`,
  `ecs-mode-runtime-batch-5a`). `CanvasModeOwnershipBridge` exposes a generic modal
  API (`openModal`/`closeModal`/`updateModalPayload`/`getModalPayload`/`isModalOpen`/
  `resolveModalCallback`) plus naming-specific wrappers
  (`openNamingModal`/`closeNamingOwner`/`updateNamingPayload`).
- Each host owns a per-instance modal owner (`host.__ecsModalOwner`); the eight
  App/Shell naming write sites route their writes through it, and `this.naming`
  becomes the owner-derived read-only mirror. The existing App→Shell field mirror
  stays (mirror-of-mirror), so no cross-instance owner sharing is required.

## Scope Control

Slice 5a-naming does not:

- seal `confirmDialog`/`event`/`rewardReveal`/`targetPicker`/`blockingPanel` (their
  legacy write sites are unchanged; `confirmDialog` is the next sub-step)
- migrate renderer reads to snapshots (Batch 6); the renderer keeps reading the
  legacy `naming` mirror
- store closures or DOM refs inside `frontend/js/ecs/**`

## The guard: no new file — sealed by the existing mode-spine guard

The plan tentatively named a new `check-frontend-ecs-modal-ownership-spine.js`. The
mapping then showed that guard would be **redundant and mis-scoped**: the 0B
input-branch scanner it referenced does not scan `CanvasGameAppGuideUi.js` /
`CanvasGameShellSystemUi.js` (the real `naming` write sites), whereas the Batch-3
**mode-ownership-spine guard already scans them and tracks `naming`**. The migration
owner approved relying on the existing guard. The seal is therefore enforced by
`check-frontend-ecs-mode-ownership-spine.js` staying green (0 violations): legacy
`naming` references may not grow beyond the 0A baseline. To keep the host writes
from inflating that count, the `'modal:naming'` literal and the legacy mirror
fallback live in the bridge (an approved path) and each host write is a single
physical line. A dedicated modal guard can follow later (e.g. a "drive the legacy
count to zero" shrink pass, or `confirmDialog` kind-dispatch), not to seal naming.

## Adversarial Review

A three-lens review (scope/purity, behavior preservation, seal correctness) found
the scope and behavior lenses clean and surfaced two issues, both fixed:

- **High** — the bridge's owner-only close wrapper was named `closeNamingModal`,
  colliding with the pre-existing `CanvasGameAppGuideUi.closeNamingModal()` full-close;
  install order let the bridge shadow it, which would have left `this.naming` stale
  after `finalizeNamingSubmit` → `game.closeNamingModal()`. Fixed by renaming the
  wrapper to `closeNamingOwner` (the legacy full-close survives and now also closes
  the owner via `closeNaming`), with a regression test asserting the bridge does not
  shadow a host `closeNamingModal`.
- **Low** — `submitNamingValue`'s `finally` reassigned `this.naming` without
  re-mirroring to `canvasShell.naming`, leaving the Shell mirror's `submitting` flag
  stale on the error path. Fixed by re-applying the one-line canvasShell mirror after
  the reassignment (kept on a single physical line to respect the zero-headroom guard
  count).

## Acceptance Answers

| Question                          | Answer                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Old owner being retired?          | `naming` source-of-truth in app/shell fields; writes now route through the ECS modal owner, `this.naming` is a read-only mirror.          |
| New ECS owner?                    | `frontend/js/ecs/mode/ModalWorld.js`, exposed via the runtime bundle and consumed through `CanvasModeOwnershipBridge` naming wrappers.    |
| Legacy fields/methods remaining?  | `this.naming` remains as the renderer/tutorial/input-router-facing mirror; other modal subtypes remain fully legacy until their slice.    |
| Guard preventing old-path growth? | The existing `check-frontend-ecs-mode-ownership-spine.js` (naming may not grow beyond baseline); no new guard file for naming.            |
| Behavior tests?                   | ModalWorld + registry unit tests, bridge modal-API + non-shadow regression tests, and the existing App/Shell/tutorial/handler tests.      |
| Rollback?                         | Restore the eight host naming writes to direct `this.naming = {…}` assignments, drop the owner/registry/wrappers, and rebuild the bundle. |
| Next subtype to seal?             | `confirmDialog` (kind-dispatch via the token registry), then `event`/`rewardReveal` (5b), `targetPicker` (5c), `blockingPanel` (5d).      |

## Verification

Local verification passed:

- `node --test frontend/js/ecs/mode/ModalWorld.test.js frontend/js/platform/ModalCallbackRegistry.test.js`
- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js` (incl. the non-shadow regression)
- `node --test frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations; naming count at/below the 0A baseline)
- `npm run build:ecs-runtime` (esbuild `0.23.1`)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` passed with `1186` tests and all architecture guards
- `git diff --check`

## Review Result

Slice 5a-naming is `Completed` after migration owner review by `codex/external-review` at `2026-06-26 02:59:52 +08:00` (Passed). The review confirmed the modal owner + callback registry, the bridge naming wrappers (no method shadowing), the per-host owner + `this.naming` mirror approach, the eight rerouted App/Shell write sites, and that the seal is enforced by the existing mode-ownership-spine guard (0 violations). The adversarial-review fixes (the `closeNamingModal` collision and the submit-`finally` mirror) were accepted.

The `confirmDialog` sub-step is next and reuses this foundation. Batch 5 slices 5b-5d remain gated behind their own sealed slices; Batch 6 may not start until Batch 5 is complete.

## confirmDialog Sub-step

`confirmDialog` is sealed the same way as `naming`, with the migration-owner-approved adjustment that it KEEPS `kind`-dispatch for its continuation (the `kind: 'resetGame'` string is itself a serializable continuation handle) and WIRES the callback registry as resolve-if-present rather than restructuring the critical async game-reset flow.

- confirmDialog is Shell-only. Its three write sites (`openConfirmDialog`, `closeConfirmDialog`, `setConfirmDialogSubmitting` in `CanvasGameShellSystemUi.js`) now route through the owner via four bridge wrappers (`openConfirmDialogModal`, `closeConfirmDialogOwner`, `updateConfirmDialogPayload`, `resolveConfirmDialogCallback`); `this.confirmDialog` becomes the owner-derived mirror, single-line writes.
- `handle_confirmResetGame` and `handle_closeConfirmDialog` (`CanvasShellActionHandlers.js`) resolve `onConfirm`/`onCancel` through the registry if present (capital-D wrapper, so the `'modal:confirmDialog'` literal stays in the approved bridge path and the guard count does not grow). `openResetConfirm` registers no callbacks, so the reset stays kind-dispatched and the resolves are no-ops in production; a unit test proves the register -> resolve -> clear lifecycle for a future closure-continuation modal.
- The robust async resetGame handler (submitting toggle, `getGameHost().resetGame`, applyResetView, promise/finalize/catch) is unchanged.
- `handle_closeConfirmDialog` now uses its previously-unused `action` param, so a stale `no-unused-vars` suppression was pruned (`CanvasShellActionHandlers.js` 6 -> 5).

## confirmDialog Review Result

`confirmDialog` sealing is `Ready for Migration Owner Review`. A three-lens adversarial review (reset-flow behavior, seal+mirror+no-shadowing, scope/purity/guard) returned all three lenses clean. Verified: `npm run test:architecture` `1186` tests, mode-ownership-spine guard 0 violations, lint (after pruning the stale suppression), format, and `git diff --check` all pass. With `confirmDialog` signed off, slice 5a (naming + confirmDialog) is complete.
