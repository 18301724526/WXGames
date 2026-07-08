# Frontend ECS Batch 8D (Event Mirror Removal) - 2026-06-25

## Status

| Field          | Value                                                   |
| -------------- | ------------------------------------------------------- |
| Batch          | `8. Bridge Retirement`                                  |
| Slice          | `8D (event / activeEventId mirror removal)`             |
| State          | `Ready for Migration Owner Review`                      |
| Removed mirror | App/Shell `this.activeEventId` (3-way host/game/shell)  |
| Snapshot path  | `getRendererSnapshot().modal['modal:event']`            |
| Guard          | `scripts/check-frontend-ecs-event-mirror-retirement.js` |
| Last updated   | `2026-06-26 23:38:10 +08:00`                            |

## Decision

Batch 8D removes the App/Shell `this.activeEventId` mirror and retires the
event-specific bridge wrappers. `modal:event` remains owned by `ModalWorld`;
runtime reads are now snapshot-derived through `CanvasModalSnapshotAdapter`. The
event payload carries the scalar `{ eventId }`.

Event differed from naming/confirmDialog/rewardReveal and needed extra care:

- **3-way sync via the snapshot merge, not field writes.** The old code wrote
  `activeEventId` to host + game + canvasShell. `buildRendererModalWorld` already
  merges the modal owner across all related hosts, so a single
  `openEventSnapshot`/`closeEventSnapshot` on any related host makes all three
  hosts' snapshots consistent. Every 2-way and 3-way close group collapsed to one
  `closeEventSnapshot()` call.
- **EventController keeps its own `activeEventId`** — the claim-target cursor in
  `frontend/js/controllers/EventController.js` is a different concern and is
  untouched. The tutorial `getActiveEventId()` read keeps the
  `eventController.activeEventId` fallback after the modal mirror reads.
- **Control-flow string token preserved.** `closePanels(['activeEventId'])` /
  `keep.has('activeEventId')` in `CanvasActionController` are control-flow keys,
  not state — kept as string literals; the wrapper + scalar clear were replaced
  with `closeEventSnapshot()`.
- **Guard-invisible idioms.** The tutorial layer wrote the mirror via
  `setIfChanged(host, 'activeEventId', null)` and an `activeEventId: null`
  patch-object key — forms a host-prefixed regex cannot see. These were
  hand-migrated to `closeEventSnapshot()`, and the retirement guard was **extended**
  with secondary patterns so the seal is fully enforced.

## Removed Mirror Surface

- Deleted App and Shell constructor initialization of `this.activeEventId`.
- Open: `handle_openEvent` now `host.openEventSnapshot(action.eventId)`.
- Close: every `activeEventId = null` (single/2-way/3-way) routes through
  `closeEventSnapshot()` (City action handlers, App/Shell commands + reset paths,
  App guide UI, Shell system UI, Shell action handlers, App rendering-runtime
  resets, `CanvasActionController.closePanels`/`closePanelsOn`).
- Reads: App/Shell input-router blocking checks use `isEventSnapshotOpen()`; the
  render runtimes emit `activeEventId` from `getEventSnapshot()?.eventId`; the
  tutorial controller/coordinator use `isEventSnapshotOpen()` / `getEventSnapshot()`.
- Removed `openEventModal` / `closeEventOwner` (and `syncEventMirrors` /
  `collectEventMirrorTargets`) from `CanvasModeOwnershipBridge.js`; its
  `collectModalKeys` and `hasBlockingOverlayExceptTechTree` use
  `isAnyModalOpen(host, 'modal:event')`.

Remaining `activeEventId` strings are the EventController cursor, the tutorial
cursor fallback, renderer option names (`options.activeEventId`), the
snapshot-derived render emit, the `'activeEventId'` control-flow tokens, and
renderer params.

## Guard Upgrade

`scripts/check-frontend-ecs-event-mirror-retirement.js` is a blocking guard. It
forbids host-prefixed `activeEventId` mirror accesses (`this`, `app`,
`canvasShell`, `game`, `host`, `lastGame`, `shell`, `uiHost`) and the retired
wrappers `openEventModal` / `closeEventOwner`. It is **extended** beyond the
8A/8B/8C guards with two secondary patterns (checked on the comment-stripped, not
string-stripped, line) so the tutorial-layer idioms cannot regress:

- `setIfChanged(<target>, 'activeEventId', ...)`
- a bare `activeEventId: null` patch-object key

`frontend/js/controllers/EventController.js` is path-excluded (it owns the
cursor). Renderer option reads (`options.activeEventId`), the render emit
(`activeEventId: snapshotEvent?.eventId ?? null`), `eventController.activeEventId`,
and the `'activeEventId'` string tokens are not flagged.

## Verification Packet

Executed before Ready for Migration Owner Review:

- `node scripts/check-frontend-ecs-event-mirror-retirement.js` (0 violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm test` (full suite, `1684` tests, 0 failures)
- `git diff --check`

A three-lens adversarial review (behavior + 3-way fan-out, seal completeness /
cursor safety, scope + guard + test fidelity) was run on the diff.

## Next Slice Candidate

After 8D sign-off, the remaining Bridge Retirement targets are the
`targetPicker` and `blockingPanel` modal subtypes (8E/8F).
