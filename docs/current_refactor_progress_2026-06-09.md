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
- Latest committed, pushed, and deployed commit: `fbdc3ca8e30c1514c08bef730df12ae840052411`
- Current architecture patch: P11-003 tile topology contract, committed as `refactor: add tile topology contracts`.
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

## Current Architecture Patch

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

## Next Architecture Work

After P11-003 is committed, continue:

1. P11-004: Large-map streaming contract.
2. P11-005: Realtime authority contract.
3. P11-006: Config/version hardening.

Do not promote the new tile topology modules to `stable` yet. They are `candidate` until downstream chunk/window/reveal and realtime contracts consume them without churn.
