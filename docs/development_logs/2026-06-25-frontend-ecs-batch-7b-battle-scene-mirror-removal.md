# Frontend ECS Batch 7B (Battle Scene Mirror Removal) - 2026-06-25

## Status

| Field          | Value                                               |
| -------------- | --------------------------------------------------- |
| Batch          | `7. Retired Layer Sealing`                            |
| Slice          | `7B (battleScene mirror removal)`                   |
| State          | `Ready for Migration Owner Review`                  |
| Owner          | `frontend/js/ecs/owner/BattleOwner.js`       |
| Removed mirror | App/Shell `this.battleScene`                        |
| Snapshot path  | `getRendererSnapshot().battle.battleScene`          |
| Guard          | `scripts/check-frontend-ecs-battle-owner.js` |
| Last updated   | `2026-06-26 17:18:00 +08:00`                        |

## Decision

Batch 7B removes the replay battle-scene mirror from App/Shell. The replay
overlay source of truth is now `BattleOwner`; renderer-facing `battleScene`
is read through `getRendererSnapshot().battle.battleScene`.

`entityBattle` remains a live mutable compatibility mirror for a later Battle
sub-slice because the current renderer/input flow still mutates session scratch
such as `_viewFit`, `_rstate`, camera state, and live sim fields.

## Removed Mirror Surface

- Deleted App constructor initialization of `this.battleScene`.
- Deleted Shell constructor initialization of `this.battleScene`.
- Removed App-to-Shell `battleScene` mirror sync and the `syncBattleSceneToShell`
  helper.
- Replaced App replay-flow reads/writes with `getBattleSceneSession()`, which
  reads `getRendererSnapshot().battle.battleScene`.
- App/Shell render options now pass `battleScene` only when present in
  `snapshot.battle.battleScene`; no legacy fallback remains.
- Shell `startBattleScene` / `closeBattleScene` now forward to `lastGame` instead
  of storing a Shell mirror.
- `battleSceneTimer` was renamed to `battleReplayTurnTimer` so string searches
  for `this.battleScene` only match intentional guard-test fixtures.

## Guard Upgrade

`scripts/check-frontend-ecs-battle-owner.js` now forbids App/Shell
`battleScene` mirror reads and writes. The guard no longer grandfathers
`CanvasGameApp.js`, `CanvasGameShell.js`, or `CanvasGameShellSystemUi.js` for
`battleScene`. `entityBattle` write growth remains guarded separately while its
live mutable mirror stays in scope for a later Battle slice.

## Verification Packet

Executed before Ready-for-Review docs:

- `node --test frontend/js/ecs/owner/BattleOwner.test.js frontend/js/ecs/snapshot/RendererSnapshotBoundary.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js scripts/check-frontend-ecs-battle-owner.test.js` (120 tests)
- `node scripts/check-frontend-ecs-battle-owner.js` (0 violations)

Full validation executed before review packet:

- `node scripts/build-frontend-ecs-runtime.js`
- `node scripts/check-frontend-ecs-renderer-snapshot-boundary.js` (0 violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `node scripts/check-frontend-ecs-blocking-panel-ownership.js` (0 violations)
- `node scripts/check-frontend-ecs-target-picker-ownership.js` (0 violations)
- `node scripts/check-frontend-ecs-input-intent-spine.js` (0 violations)
- `node scripts/check-frontend-ecs-boundary-skeleton.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1232 tests; architecture smoke passed)
- `git diff --check`

Result: all checks passed. Production App/Shell code has no `this.battleScene`
mirror references; remaining `this.battleScene` strings are guard-test fixtures
and historical baseline docs only.
