# Frontend ECS Batch 7A (Battle Domain Owner) - 2026-06-25

## Status

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| Batch            | `7. Domain Area Sealing`                            |
| Slice            | `7A (battle domain owner)`                          |
| State            | `Ready for Migration Owner Review`                  |
| Owner            | `frontend/js/ecs/domain/BattleDomainOwner.js`       |
| Snapshot path    | `RendererSnapshotBoundary` emits `snapshot.battle`  |
| Guard            | `scripts/check-frontend-ecs-battle-domain-owner.js` |
| Runtime exposure | `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`   |
| Last updated     | `2026-06-26 16:35:30 +08:00`                        |

## Decision

Batch 7A establishes a Battle domain owner for battle overlay/session facts only:
legacy replay `battleScene` and interactive/replay `entityBattle`. It does not
migrate BattleSimCore, AI stepping, camera math, renderer drawing, timers, or
server resolve behavior.

The owner snapshot shape is:

- `schema`: fixed string `battle-domain-v1`
- `battleScene`: frozen serializable replay overlay facts or `null`
- `entityBattle`: frozen serializable session facts or `null`
- `activeOverlay`: `none`, `battleScene`, or `entityBattle`

## Implementation Notes

- `CanvasGameAppBattleScene.js` is the approved canonical adapter: open/update/close
  paths write the owner and keep existing mirrors for compatibility.
- `CanvasModeOwnershipBridge.js` gained no Battle open/close wrappers. The only
  Battle addition there is read-only fact collection for existing
  `buildRendererSnapshot` / `getRendererSnapshot`.
- Render options prefer `snapshot.battle.battleScene` over `this.battleScene`;
  `entityBattle` keeps the live mutable mirror in 7A because the renderer writes
  scratch fields such as `_viewFit` and `_rstate`.
- Dedicated guard blocks new Battle canonical writes outside owner/snapshot/runtime
  and the approved `CanvasGameAppBattleScene.js` adapter.

## 7B Cleanup Plan

7B mirror deletion target: App-side `this.battleScene`.

Deletion order:

1. Make App/Shell render options pass `battleScene` only from
   `getRendererSnapshot().battle.battleScene`.
2. Replace `CanvasGameAppBattleScene.js` replay-flow reads of `this.battleScene`
   with an owner snapshot helper such as `getBattleSceneSession()`.
3. Remove App-to-Shell `battleScene` mirror sync or make Shell compatibility derive
   it from snapshot only.
4. Delete constructor initialization `this.battleScene = null`.
5. Tighten `check-frontend-ecs-battle-domain-owner.js` so App-side
   `this.battleScene` reads/writes are forbidden instead of grandfathered.

Estimated 7B surface: 5-7 files: battle scene runtime, App/Shell rendering runtime,
snapshot boundary, battle guard/test, and docs. `this.entityBattle` remains a later
Battle cleanup target because it still carries live mutable sim/session state.

## Verification Packet

Executed before Ready-for-Review docs:

- `node --test frontend/js/ecs/domain/BattleDomainOwner.test.js frontend/js/ecs/snapshot/RendererSnapshotBoundary.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/CanvasGameApp.test.js scripts/check-frontend-ecs-battle-domain-owner.test.js`
- `node --test scripts/check-frontend-ecs-battle-domain-owner.test.js scripts/check-frontend-ecs-mode-ownership-spine.test.js`
- `node scripts/check-frontend-ecs-battle-domain-owner.js`
- `node scripts/check-frontend-ecs-renderer-snapshot-boundary.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js`
- `node scripts/check-frontend-ecs-blocking-panel-ownership.js`
- `node scripts/check-frontend-ecs-target-picker-ownership.js`
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1229 tests; architecture smoke passed)
- `git diff --check`

Result: targeted tests passed, all listed ownership/snapshot guards reported 0
violations, lint/format passed, architecture smoke passed, and whitespace checks
passed.
