# Current Refactor Progress - 2026-06-09

This is the operational progress note for the current Codex run. It is not a product or architecture authority; the authority docs remain:

- `docs/current_product_design_2026-06-09.md`
- `docs/current_gameplay_design_2026-06-09.md`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`

## Current Status

- Branch: `main`
- Latest architecture commit pushed and deployed: `712ca9012c867b9880b88692e1f97a4e7d544036`
- Current architecture patch: P11-005 realtime authority contract, verified locally and pending commit/deploy.
- Online H5 URL: `http://47.116.32.216/wxgame/`
- Protected Cocos root: `http://47.116.32.216/`
- Unrelated untracked `tools/` exists and must remain untouched unless the user explicitly asks for it.

## Verified And Deployed Tutorial Fixes

Recent deployed commits:

```text
8de49cce93060794b421b052630153c5a65bc9c3 fix: preserve naming submit promise
1bb8ba95a67841c8de82f3cdafdea9b6e4cb224d fix: keep guided resource highlights visible
f185057f2ec0c2c84b14cbb2eb607518f83fd0d4 fix: preserve guide render target during refresh
```

Behavior fixed:

- Naming submission now preserves the API Promise instead of being swallowed by generic forwarding.
- Guided resource-system steps now click the real naming input path and answer `window.prompt`.
- Resource-page tutorial highlights now keep their explicit render target across active refreshes, preventing invisible-but-clickable guide targets.

Verification before deploying `f185057f2ec0c2c84b14cbb2eb607518f83fd0d4`:

```powershell
node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/GameCommandService.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 70 passed
- Architecture gate: 390 passed
- Stable block manifest guard: passed
- Official document guard: passed
- `git diff --check`: passed
- Full test suite: 757 passed

Deployment verification after `f185057f2ec0c2c84b14cbb2eb607518f83fd0d4`:

- `/wxgame/.wxgame-deploy-version.json`
  - `commit`: `f185057f2ec0c2c84b14cbb2eb607518f83fd0d4`
  - `workTree`: `/www/wwwroot/h5`
  - `frontendPublicDir`: `/www/wwwroot/h5`
- `http://47.116.32.216:3000/api/health` returned OK.
- `http://47.116.32.216/` still contains `Cocos Creator`.
- `http://47.116.32.216/` still contains `civilization-fire-next-client`.
- `http://47.116.32.216/` does not contain H5 authority markers.
- `http://47.116.32.216/wxgame/` contains `authority-state-refresh-v1`.
- `http://47.116.32.216/wxgame/` contains `CanvasGameShellRenderingRuntime`.

## Online Tutorial Playtest

Command:

```powershell
$env:PLAYTEST_MAX_ACTIONS='140'; npm.cmd run playtest:online-tutorial
```

Latest completed run directory:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-08T23-54-53-188Z
```

Result:

- Stop reason: `tutorial-completed`
- Final tutorial step: `36`
- Final step name: `completed`
- Tutorial completed: `true`
- Action count: `59`
- Evidence count: `51`
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none

The online tutorial flow is currently verified with screenshot evidence. No active online tutorial blocker remains.

## Previous Architecture Patch

P11-003 tile topology contract is complete, verified, committed, pushed, and deployed.

Changed files:

- `frontend/js/domain/TileCoord.js`
- `frontend/js/domain/TileCoord.test.js`
- `frontend/js/domain/WorldTopology.js`
- `frontend/js/domain/WorldTopology.test.js`
- `frontend/js/domain/TileMapGeometry.js`
- `frontend/js/domain/TileMapGeometry.test.js`
- `frontend/index.html`
- `frontend/minigame/game.js`
- `scripts/run-architecture-smoke.js`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/current_refactor_progress_2026-06-09.md`
- `docs/current_codex_transfer_2026-06-09.md`

Behavior added:

- `TileCoord` defines stable `x/y` tile coordinates and keeps `q/r` as compatibility aliases.
- `WorldTopology` defines full wrapping torus coordinate normalization and shortest wrapped delta/distance.
- `TileMapGeometry` now consumes the coordinate contract while preserving its legacy projection API.
- H5 and minigame entrypoints load `TileCoord` and `WorldTopology` before `TileMapGeometry`.
- The new files are included in `npm.cmd run test:architecture`.

Current verification:

```powershell
node --test frontend/js/domain/TileCoord.test.js frontend/js/domain/WorldTopology.test.js frontend/js/domain/TileMapGeometry.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 11 passed
- Architecture gate: 401 passed
- Stable block manifest guard: passed
- Official document guard: passed
- `git diff --check`: passed
- Full test suite: 768 passed

Deployment verification after `fbdc3ca8e30c1514c08bef730df12ae840052411`:

- `/wxgame/.wxgame-deploy-version.json`
  - `commit`: `fbdc3ca8e30c1514c08bef730df12ae840052411`
  - `workTree`: `/www/wwwroot/h5`
  - `frontendPublicDir`: `/www/wwwroot/h5`
- `http://47.116.32.216:3000/api/health` returned OK.
- `http://47.116.32.216/` still contains `Cocos Creator`.
- `http://47.116.32.216/` still contains `civilization-fire-next-client`.
- `http://47.116.32.216/` does not contain `TileCoord` or `authority-state-refresh-v1`.
- `http://47.116.32.216/wxgame/` contains `TileCoord.js?v=architecture-refactor-tile-topology-v1`.
- `http://47.116.32.216/wxgame/` contains `WorldTopology.js?v=architecture-refactor-tile-topology-v1`.
- `http://47.116.32.216/wxgame/` contains `authority-state-refresh-v1`.

Online tutorial smoke after P11-003 deploy:

```powershell
$env:PLAYTEST_MAX_ACTIONS='140'; npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-09T00-09-38-297Z
```

Result:

- Stop reason: `tutorial-completed`
- Final tutorial step: `36`
- Final step name: `completed`
- Tutorial completed: `true`
- Action count: `59`
- Evidence count: `51`
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none

## Current Architecture Patch

P11-004 large-map streaming contract is complete, fully verified, committed, pushed, and deployed.

Changed files:

- `frontend/js/domain/WorldChunkAddress.js`
- `frontend/js/domain/WorldChunkAddress.test.js`
- `frontend/js/domain/WorldInterestWindow.js`
- `frontend/js/domain/WorldInterestWindow.test.js`
- `frontend/js/domain/WorldRevealStore.js`
- `frontend/js/domain/WorldRevealStore.test.js`
- `frontend/index.html`
- `frontend/minigame/game.js`
- `scripts/run-architecture-smoke.js`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/current_refactor_progress_2026-06-09.md`
- `docs/current_codex_transfer_2026-06-09.md`

Behavior added:

- `WorldChunkAddress` defines chunk size, chunk id, chunk coordinate, chunk bounds, tile-to-chunk mapping, and wrapped tile-rect expansion.
- `WorldInterestWindow` defines visible, preload, and AOI windows over stable tile coordinates and chunk lists, including wrapped edge membership checks.
- `WorldRevealStore` defines a persistent revealed-terrain store by tile id and chunk id, including materialized chunk ids and serializable output without renderer payloads or a full `worldMap`.
- H5 and minigame entrypoints load the new large-map domain contracts after `TileCoord`/`WorldTopology` and before renderer-facing map modules.
- The new files are included in `npm.cmd run test:architecture`.

Focused verification already passed:

```powershell
node --test frontend/js/domain/WorldChunkAddress.test.js frontend/js/domain/WorldInterestWindow.test.js frontend/js/domain/WorldRevealStore.test.js
```

Results:

- Focused tests: 12 passed

Full verification already passed:

```powershell
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Architecture gate: 413 passed
- Stable block manifest guard: passed
- Official document guard: passed
- `git diff --check`: passed
- Full test suite: 780 passed

Deployment verification after `712ca9012c867b9880b88692e1f97a4e7d544036`:

- `/wxgame/.wxgame-deploy-version.json`
  - `commit`: `712ca9012c867b9880b88692e1f97a4e7d544036`
  - `workTree`: `/www/wwwroot/h5`
  - `frontendPublicDir`: `/www/wwwroot/h5`
- `http://47.116.32.216:3000/api/health` returned OK with config version `2.3`.
- `http://47.116.32.216/` still contains `Cocos Creator`.
- `http://47.116.32.216/` still contains `civilization-fire-next-client`.
- `http://47.116.32.216/` does not contain `WorldChunkAddress` or `authority-state-refresh-v1`.
- `http://47.116.32.216/wxgame/` contains `WorldChunkAddress.js?v=architecture-refactor-large-map-contract-v1`.
- `http://47.116.32.216/wxgame/` contains `WorldInterestWindow.js?v=architecture-refactor-large-map-contract-v1`.
- `http://47.116.32.216/wxgame/` contains `WorldRevealStore.js?v=architecture-refactor-large-map-contract-v1`.
- `http://47.116.32.216/wxgame/` contains `authority-state-refresh-v1`.

Online tutorial smoke after P11-004 deploy:

```powershell
$env:PLAYTEST_MAX_ACTIONS='140'; npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-09T00-30-51-079Z
```

Result:

- Stop reason: `tutorial-completed`
- Final tutorial step: `36`
- Final step name: `completed`
- Tutorial completed: `true`
- Action count: `59`
- Evidence count: `51`
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none

## P11-005 Realtime Authority Contract

Current local implementation:

- Added `backend/services/realtime/CommandAuthorityContract.js`.
- Added `backend/services/realtime/ServerTimelineSnapshot.js`.
- Added `backend/services/realtime/AoiSyncSnapshot.js`.
- Added `backend/services/realtime/index.js`.
- Added `backend/tests/RealtimeAuthorityContract.test.js`.
- `startWorldMarch`, `returnWorldMarch`, and `stopWorldMarch` now return an `authority` envelope with server-owned command/timeline/AOI metadata.
- `stopWorldMarch` ignores frontend target/stop coordinates and derives the stop tile from the server timeline.
- `GameActionRegistry` strips world-march stop coordinates before dispatch.
- `CanvasTerritoryActionHandlers`, `CanvasGameAppCommands`, `GameAPI`, and `WorldMarchHudCanvasRenderer` now send stop as intent-only `missionId`.
- `scoutTerritory`, `claimScout`, `startConquest`, and `claimConquest` attach the same command authority envelope.
- `scripts/run-architecture-smoke.js` now includes realtime authority syntax checks and focused tests.
- `backend/services/VersionService.js` now ignores local SQLite runtime files (`.sqlite`, `.sqlite-wal`, `.sqlite-shm`, `.sqlite3` variants) when computing deployment/source hashes, preventing local playtest database writes from triggering false update reloads.
- `.gitignore` now ignores local SQLite runtime files under `backend/` and `backend/data/`.

Focused verification already passed locally:

```powershell
node --test backend/tests/RealtimeAuthorityContract.test.js backend/tests/WorldExplorerService.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameActionRegistry.test.js backend/tests/TerritoryActionTutorial.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/renderers/WorldMarchHudCanvasRenderer.test.js
```

Result:

- Focused tests: 56 passed

Additional local stability verification:

```powershell
node --test backend/tests/VersionService.test.js
```

Result:

- Version service tests: 2 passed

Local browser tutorial playtest with screenshots:

```powershell
$env:PLAYTEST_GAME_URL='http://127.0.0.1:8080/'
$env:PLAYTEST_API_BASE='http://127.0.0.1:8080/api'
$env:PLAYTEST_USERNAME='codexqa'
$env:PLAYTEST_PASSWORD='123456'
$env:PLAYTEST_RESET_ACCOUNT='1'
$env:PLAYTEST_MAX_ACTIONS='140'
$env:PLAYTEST_OUTPUT_DIR='.local-logs/local-tutorial-p11-005'
npm.cmd run playtest:online-tutorial
```

Output:

```text
E:\Human\wxgame\.local-logs\local-tutorial-p11-005\2026-06-09T04-03-52-338Z
```

Result:

- Stop reason: `tutorial-completed`
- Final tutorial step: `36`
- Final step name: `completed`
- Tutorial completed: `true`
- Action count: `60`
- Evidence count: `51`
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none

Full local verification:

```powershell
$env:ALLOW_STABLE_BLOCK_REOPEN='1'
$env:STABLE_BLOCK_REOPEN_REASON='governance-update'
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Architecture gate: 419 passed
- Stable block manifest guard: passed with `governance-update` reopen env because the manifest promotion queue changed
- Official document guard: passed
- `git diff --check`: passed
- Full test suite: 785 passed

P11-005 local status:

- Complete and verified locally.
- Pending commit, push, deploy, and online verification.

## Next Architecture Work

After P11-005 local verification is complete, continue:

1. P11-006: Config/version hardening.
2. Downstream realtime adoption: multiplayer transport, presenter/runtime consumers, and AOI stress checks.

Do not promote the new tile topology, large-map streaming, or realtime authority modules to `stable` yet. They are `candidate` until downstream presenter/runtime/renderer and multiplayer transport consumers prove the extension surface without churn.
