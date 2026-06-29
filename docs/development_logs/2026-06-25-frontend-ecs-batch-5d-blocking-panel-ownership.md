# Frontend ECS Batch 5 Slice 5d (Panel/Modal Ownership: blockingPanel) - 2026-06-25

## Status

| Field            | Value                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Batch            | `5. Panel/Modal Ownership`                                                                                             |
| Slice            | `5d (blockingPanel)`                                                                                                   |
| State            | `Completed`                                                                                                            |
| ECS modal owner  | `frontend/js/ecs/mode/ModalWorld.js` (reused)                                                                          |
| Bridge surface   | `openBlockingPanelOwner` / `closeBlockingPanelOwner` / `closeBlockingPanelsOwner`                                      |
| Seal enforced by | `scripts/check-frontend-ecs-blocking-panel-ownership.js` plus architecture smoke and the existing mode ownership guard |
| Last updated     | `2026-06-26 15:34:13 +08:00`                                                                                           |

## Decision

Slice 5d uses the approved lighter umbrella design: `modal:blockingPanel` owns the
open/close signal for blocking panels, but panel-specific business data remains in
its legacy feature owner. The owner payload stores only:

- `panelKey`: the legacy mirror field, such as `showSettings`, `showTaskCenter`,
  `activeCommandPanel`, or `techDetailOpen`
- `panelKind`: stable semantic names such as `settings`, `taskCenter`,
  `commandPanel`, or `techDetail`
- `value`: boolean panel state or the command-panel name

Canonical action-handler opens now route through bridge wrappers. The bridge syncs
host/game/canvasShell mirrors internally, so handlers do not inline three-way mirror
writes.

## Scope Control

Slice 5d does not:

- migrate panel business state such as task-center tab, guidebook tab, selected tech,
  famous-person page, or selected famous-person detail into modal ownership
- migrate `armyFormationEditor`; it remains a `formationEditor` base-mode concern
- migrate `tutorialAdvisorDialogue`; advisor open/close only routes `showAdvisor`
- chase scattered reset/tab-switch/render-runtime/tutorial clears or legacy tutorial
  coordinator opens; `TutorialGuideUiStateCoordinator` is grandfathered by the new
  guard as an explicit lighter-design exception
- migrate renderer/tutorial reads off legacy mirrors; that remains Batch 6 snapshot work

## Acceptance Answers

| Question                          | Answer                                                                                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old owner being retired?          | Canonical blocking-panel opens in shell/city/famous action handlers for resource details, command panel, city switcher, subcity list, settings, logs, advisor, guidebook, city management, task center, tech detail, and famous persons.  |
| New ECS owner?                    | `frontend/js/ecs/mode/ModalWorld.js`, through `CanvasModeOwnershipBridge` blockingPanel wrappers.                                                                                                                                         |
| Legacy fields/methods remaining?  | `show*`, `activeCommandPanel`, and `techDetailOpen` remain renderer/tutorial-facing mirrors; serializable gameplay state remains in existing handlers/commands.                                                                                          |
| Guard preventing old-path growth? | `scripts/check-frontend-ecs-blocking-panel-ownership.js` blocks direct canonical opens outside the bridge, grandfathers 0A baseline opens, and explicitly grandfathers tutorial coordinator scattered opens while allowing legacy clears. |
| Behavior tests?                   | Bridge blockingPanel wrapper tests, CanvasActionController close-order tests, shell/city/famous owner-call tests, and the dedicated guard tests.                                                                                          |
| Rollback?                         | Restore direct canonical handler writes for covered opens, remove blockingPanel wrappers/tests/guard wiring, and drop this batch doc.                                                                                                     |
| Batch 5 status?                   | Slice 5d is `Completed` after migration owner sign-off. Batch 5 is fully `Completed`; Batch 6 may start after this completion commit reaches the server branch.                                                                           |

## Verification

Local verification for the Ready-for-Review implementation:

- `node --test frontend/js/platform/CanvasActionController.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/CanvasFamousActionHandlers.test.js scripts/check-frontend-ecs-blocking-panel-ownership.test.js`
- `node scripts/check-frontend-ecs-blocking-panel-ownership.js` (0 violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1209 tests)
- `git diff --check`

All full gate commands passed before the Ready-for-Review commit was pushed.

## Review Result

`blockingPanel` sealing is `Completed` after migration owner sign-off on
`2026-06-26 15:34:13 +08:00`. The review accepted the lighter umbrella owner,
bridge mirror sync, canonical handler scope, central close order, dedicated guard
scope, explicit grandfathering of tutorial coordinator scattered opens, and the
deferred renderer/tutorial read migration. Batch 5 is complete; Batch 6 may start
after this completion commit reaches the server branch.
