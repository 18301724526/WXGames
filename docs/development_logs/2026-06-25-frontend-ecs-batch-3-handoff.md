# Frontend ECS Batch 3 Handoff - 2026-06-25

## Branch

- Server git URL: `http://wxgame:wxgame123@47.116.32.216:3001/wxgame.git`
- Branch: `codex/refactor-tutorial-guide-architecture`
- Latest server branch commit: `51d3b2657a35dfac2b206b3bfbe9761c03f4bf2d`
- Refactor test deploy health confirmed deployed commit: `51d3b2657a35dfac2b206b3bfbe9761c03f4bf2d`
- Batch status: `Ready for Migration Owner Review`, not `Completed`

## Pull Commands

Fresh clone:

```bash
git clone http://wxgame:wxgame123@47.116.32.216:3001/wxgame.git
cd wxgame
git checkout codex/refactor-tutorial-guide-architecture
```

Existing clone:

```bash
git fetch origin codex/refactor-tutorial-guide-architecture
git checkout codex/refactor-tutorial-guide-architecture
git pull origin codex/refactor-tutorial-guide-architecture
```

## Commits

- `8969451a chore: add frontend ecs batch 3 mode ownership spine`
  - Main Batch 3 implementation.
- `51d3b265 chore: fix ecs mode runtime deploy lint gate`
  - Adds generated bundle ESLint disable header through the build script and fixes one unused catch parameter.

## What Changed

- Added ECS mode owner modules under `frontend/js/ecs/mode/`.
- Added generated H5/minigame runtime bundle at `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`.
- Added `scripts/build-frontend-ecs-runtime.js` and `npm run build:ecs-runtime`.
- Added `frontend/js/platform/CanvasModeOwnershipBridge.js`.
- Wired `CanvasGameApp` and `CanvasGameShell` to install the mode bridge before input routers.
- Updated App/Shell input routers to prefer mode snapshot helpers for:
  - blocking overlay checks
  - entity battle checks
  - world map route checks
  - tech-tree route checks
- Updated H5 and minigame loading chains to load only the generated ECS mode bundle plus the bridge.
- Updated `EcsBoundaryManifest` so core/registry remain architecture-only, while the generated mode runtime bundle is the only approved runtime ECS surface.
- Added `scripts/check-frontend-ecs-mode-ownership-spine.js` as a blocking guard.
- Updated boundary and manifest guards/tests for the approved runtime bundle.
- Updated progress and operating-plan docs for Batch 3.

## Important Scope Notes

Batch 3 does not migrate physical input intent, concrete modal payload ownership, renderer snapshots, gameplay serializable gameplay state, or tutorial flow ownership.

Old mode/panel fields still exist. They are read by `CanvasModeOwnershipBridge.js` as temporary ingress facts. Growth outside the ECS mode owner, generated bundle, bridge, or vocabulary manifest is blocked by the new mode spine guard.

Generic blocking overlay behavior still treats the tech command panel as blocking. Tech-tree routing keeps the old exception through `techTreeBlockingOverlayActive`, preserving the previous `hasBlockingOverlayExceptTechTree()` behavior.

## Verification

Local verification passed:

- `npm run build:ecs-runtime`
- `node --test frontend/js/ecs/**/*.test.js`
- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js`
- `node --test scripts/check-frontend-ecs-boundary-skeleton.test.js scripts/check-frontend-ecs-mode-ownership-spine.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-boundary-skeleton.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js`
- `node scripts/check-frontend-script-manifest.js`
- `node --test frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js`
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` passed with `1154` tests.
- `git diff --check`

Server manual deploy passed after the HTTP push hook timed out:

- lint passed
- format passed
- node tests passed
- architecture smoke passed
- frontend manifest passed
- backend syntax check passed
- health returned `status: ok` with deployed commit `51d3b2657a35dfac2b206b3bfbe9761c03f4bf2d`

## Next Review Step

Architecture review should check:

- whether the singleton mode entity is acceptable as the first runtime ECS owner
- whether `CanvasModeOwnershipBridge.js` is narrow enough as a temporary bridge
- whether `check-frontend-ecs-mode-ownership-spine.js` blocks the right legacy growth
- whether generated IIFE runtime loading is acceptable until the frontend has a broader build pipeline

After review passes, make a separate docs commit marking Batch 3 as `Completed`. Batch 4 must not start before that completion commit.
