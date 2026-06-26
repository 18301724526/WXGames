# Frontend ECS Batch 8E (Target Picker Mirror Removal) - 2026-06-25

## Status

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Batch          | `8. Bridge Retirement`                                               |
| Slice          | `8E (targetPicker mirror removal, Option B snapshot-direct)`         |
| State          | `Ready for Migration Owner Review`                                   |
| Removed mirror | `territoryUiState.worldTargetPicker` + `worldMarchTarget.pickerOpen` |
| Snapshot path  | `getRendererSnapshot().modal['modal:targetPicker']`                  |
| Guard          | `scripts/check-frontend-ecs-target-picker-mirror-retirement.js`      |
| Last updated   | `2026-06-27 01:09:27 +08:00`                                         |

## Decision

Batch 8E removes the targetPicker modal mirror and retires the three picker bridge
wrappers. `modal:targetPicker` remains owned by `ModalWorld`; its payload is a
**structured** object discriminated by `pickerKind`
(`{ pickerKind: 'worldTargetPicker', picker }` or
`{ pickerKind: 'worldMarchFormation', target }`).

targetPicker is the most entangled modal: its state was **nested inside
`territoryUiState`** (`worldTargetPicker` + a `pickerOpen` flag fused onto the
`worldMarchTarget` object, which also carries world-march DOMAIN data). The
migration owner chose **Option B (snapshot-direct)**: `territoryUiState` now
carries ZERO picker-modal fields, and the picker state flows to consumers from the
owner.

- **Owner gets the modal state:** the whole `worldTargetPicker` candidate object
  and the `pickerOpen` flag move into the owner payload.
- **`territoryUiState` keeps the domain:** `worldMarchTarget`'s
  coords/route/mission/actor/combat/known/terrain fields stay untouched; only the
  `pickerOpen` flag was peeled off.
- **Renderer threading:** the render runtimes derive
  `snapshotTargetPicker = getTargetPickerSnapshot()` and pass it as a dedicated
  `options.targetPicker` render option, threaded through
  `CanvasFrameRenderer` -> `HudOverlayCanvasRenderer` -> the
  `WorldMarchHudCanvasRenderer.renderWorldMarchHud` chain. The HUD reads the picker
  off the option (not `territoryUiState`); the formation-picker dispatch keys on
  `pickerKind === 'worldMarchFormation'` instead of `target.pickerOpen`.
- **Domain normalizers** (`WorldMarchGeometry.getMarchTargetUiState`,
  `WorldMapRenderSnapshot.normalizeMarchTarget`) stopped copying `pickerOpen`.
- **Tutorial gate** `isWorldMarchFormationPickerOpen` reads the owner
  (`isTargetPickerSnapshotOpen()` + `pickerKind === 'worldMarchFormation'`) — it
  reads the raw controller uiState, so it had to move to the owner regardless.
- **Close semantics preserved:** closing the picker keeps `worldMarchTarget`
  (coords survive); `closeWorldMarchHud` / `startWorldMarch` / `selectWorldActor`
  still drop `worldMarchTarget` (domain teardown). Same-looking writes, opposite
  intent — handled per-site.

## Removed Mirror Surface

- Deleted the `worldTargetPicker: null` seed (and three vestigial
  `worldTargetPicker = null` writes) from `TerritoryController`.
- Removed `openWorldTargetPickerOwner` / `openWorldMarchFormationPickerOwner` /
  `closeTargetPickerOwner` (and the now-dead `syncTerritoryUiStateMirror` /
  `resolveTerritoryUiState` / `collectTerritoryMirrorTargets`) from
  `CanvasModeOwnershipBridge.js`; `collectModalKeys` uses
  `isAnyModalOpen(host, 'modal:targetPicker')`.
- `CanvasTerritoryActionHandlers` opens/closes via the snapshot adapter;
  `handle_chooseWorldTarget` re-sources its candidate list from
  `getTargetPickerSnapshot()?.picker`.

`territoryUiState` no longer contains `worldTargetPicker`, and `worldMarchTarget`
no longer contains `pickerOpen`. Remaining `targetPicker`/`worldTargetPicker`/
`pickerOpen` strings are the owner payload, `options.targetPicker` reads, locale
labels (`t('world.targetPicker.*')`), and the `'modal:targetPicker'` ECS
declarations.

## Guard Upgrade

`scripts/check-frontend-ecs-target-picker-mirror-retirement.js` is a new blocking
guard. It forbids the three retired wrappers and the mirror writes
`<host>.worldTargetPicker =` (including `= null`), `worldMarchTarget...pickerOpen =`,
and `pickerOpen: true|false` modal-flag literals. It does not flag world-march
domain `worldMarchTarget` access, locale labels, the `'modal:targetPicker'`
declarations, or `options.targetPicker` reads. `TerritoryController.js` is
path-excluded (it owns the territory uiState).

The pre-existing `scripts/check-frontend-ecs-target-picker-ownership.js` required
picker opens to route through the now-deleted bridge wrappers, so its invariant
became obsolete; an adversarial review flagged it as self-contradictory and it was
removed (with its test and smoke wiring). The new retirement guard is the single
authoritative seal for targetPicker.

## Verification Packet

Executed before Ready for Migration Owner Review:

- `node scripts/check-frontend-ecs-target-picker-mirror-retirement.js` (0 violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm test` (full suite, `1686` tests, 0 failures)
- `git diff --check`

A three-lens adversarial review (behavior and renderer threading; seal completeness
and the tutorial gate; scope, guards, and test fidelity) was run on the diff.

## Next Slice Candidate

After 8E sign-off, the final Bridge Retirement target is the `blockingPanel`
modal subtype (8F).
