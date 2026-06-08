# Current Refactor Progress - 2026-06-09

This is an operational progress note for the current Codex run. It is not a product or architecture authority; the authority docs remain:

- `docs/current_product_design_2026-06-09.md`
- `docs/current_gameplay_design_2026-06-09.md`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`

## Current Status

- Branch: `main`
- Latest committed and deployed commit before the current local patch: `056e4c5b05bc08eb7ee8356b10c34783ce1c11d3`
- Latest deployed fixes:
  - `7bb8a034a8d609a54b4c857b44d53c13ffece299 fix: expose world march hud hit targets`
  - `056e4c5b05bc08eb7ee8356b10c34783ce1c11d3 fix: refresh world march tutorial highlight`
- Current local patch, not committed yet:
  - `frontend/js/services/GameStateSync.js`
  - `frontend/js/services/GameStateSync.test.js`
  - `frontend/js/platform/CanvasGameApp.js`
  - `frontend/js/platform/CanvasGameApp.test.js`
  - `frontend/index.html`
- Online H5 URL: `http://47.116.32.216/wxgame/`
- Protected Cocos root: `http://47.116.32.216/`

## Verified Before Current Patch

- Focused renderer/tutorial tests after the world march HUD hit-target fix:
  - `node --test frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/WorldMarchHudCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/CanvasGameShell.test.js`
  - Passed: 93 tests
- Focused tests after the tutorial highlight refresh fix:
  - `node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/CanvasGameShell.test.js`
  - Passed: 84 tests
- `npm.cmd run test:architecture`
  - Passed: 380 tests
  - Passed stable block manifest guard
  - Passed official document guard
  - Passed `git diff --check`
- `npm.cmd test`
  - Passed: 741 tests
- Deploy stamp after `056e4c5b05bc08eb7ee8356b10c34783ce1c11d3`:
  - `/wxgame/.wxgame-deploy-version.json`
  - `workTree`: `/www/wwwroot/h5`
  - `frontendPublicDir`: `/www/wwwroot/h5`
- API health:
  - `http://47.116.32.216:3000/api/health` returned OK
- Cocos root protection:
  - `http://47.116.32.216/` still contains `Cocos Creator`
  - root page still contains `civilization-fire-next-client`

## Current Patch Verification

- Focused test passed:
  - `node --test frontend/js/services/GameStateSync.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasGameShell.test.js`
  - Passed: 58 tests
- `npm.cmd run test:architecture`
  - Passed: 380 tests
  - Passed stable block manifest guard
  - Passed official document guard
  - Passed `git diff --check`
- `npm.cmd test`
  - Passed: 744 tests
- Behavior added:
  - Heartbeat remains lightweight liveness only.
  - When a local active world exploration mission reaches `nextStepAt` or `completesAt`, `GameStateSync` performs a throttled `/game/state` authority refresh.
  - `CanvasGameApp` applies the refreshed authority state through the existing `applyApiState` path.
  - `frontend/index.html` cache keys for `GameStateSync.js` and `CanvasGameApp.js` were updated to `authority-state-refresh-v1`.

## Latest Online Tutorial Playtest

Command:

```powershell
npm.cmd run playtest:online-tutorial
```

Latest completed run directory:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-08T21-10-00-214Z
```

Result:

- Stop reason: `max-actions-reached`
- Final tutorial step: `24`
- Final step name: `scoutExploreStarted`
- Tutorial completed: `false`
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none
- Positive evidence:
  - Previous blocker fixed: `highlight-openWorldMarchFormationPicker-37...`
  - Previous blocker fixed: `highlight-startWorldMarch-38...`
  - Step 23 successfully advanced into `scoutExploreStarted`.
  - Screenshot crops were nonblank.
- Current issue being fixed:
  - While waiting on step 24, the playtest only saw `/version` requests and no `/game/state` refresh.
  - `worldExplorerState.activeMission` remained active even though its timing had reached the next sync point.
  - The current local patch makes the frontend refresh authority state when the active world exploration mission reaches a server-owned timing boundary.

## Next Required Gates

Before committing and deploying the current patch:

1. Commit and push to `origin/main` and `private/main`.
2. Verify deployment stamp, API health, and Cocos root protection.
3. Rerun `npm.cmd run playtest:online-tutorial`.
4. Update this document and `docs/current_codex_transfer_2026-06-09.md`.

## Next Architecture Work

After the online tutorial flow is fixed or has a newer documented blocker, continue the long-term plan from `docs/long_term_architecture_refactor_plan_2026-06-08.md`:

1. P11-003: Tile topology contract.
2. P11-004: Large-map streaming contract.
3. P11-005: Realtime authority contract.
4. P11-006: Config/version hardening.

Do not promote more stable blocks until their extension surface and reopen policy are documented in:

- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`
