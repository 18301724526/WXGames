# Current Codex Transfer - 2026-06-09

This is the active transfer note for the next Codex session. It is a working note, not a product or architecture authority.

## User Intent

The user wants long-term architecture health to reach the documented target:

- modular, block-like development
- stable lower-level files sealed after completion
- feature iteration through explicit interfaces and extension points
- old stable internals reopened only for bugs, performance, security, contract updates, or governance

The user also wanted the online tutorial flow verified with screenshots before deeper refactor work continued. That verification is now complete.

## Do Not Break

- Workspace: `F:\AI Project\WXGamesLocal`
- Shell: PowerShell
- Use `npm.cmd`, not bare `npm`
- Do not touch unrelated untracked `tools/`
- H5 deploy path: `/www/wwwroot/h5`
- Online H5 URL: `http://47.116.32.216/wxgame/`
- Protected Cocos project: `/www/wwwroot/civilization-fire-next`
- Public root `http://47.116.32.216/` must remain the Cocos project
- Deploy script has path guards; keep them intact
- Avoid creating docs with filenames containing `handoff`; official docs guard treats them as obsolete.

## Current Online Playtest Thread

The active user request is to test the live H5 game in the Codex in-app browser, especially:

- world marching
- HUD placement
- return-home
- unlocking new map tiles

Evidence directory:

```text
F:\AI Project\WXGamesLocal\.local-logs\manual-online-playtest\2026-06-10-world-march
```

Current runtime fix:

- `CanvasTerritoryActionHandlers.handle_resetWorldPan()` now resets the runtime world camera and shared `worldPanX/worldPanY`.
- It also performs the local shell reset after a forwarded `resetWorldPan` action succeeds, covering the live split between `CanvasGameShell` and `CanvasGameApp`.

Verified locally before commit/deploy:

```powershell
node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/WorldMapRuntime.test.js frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js frontend/js/platform/CanvasGameShellWorldMapFrameRuntime.test.js
npm.cmd run test:architecture
git diff --check
```

Results:

- Focused runtime regression: 56 passed.
- Architecture gate: 472 passed.
- Stable block manifest guard: passed.
- Official document guard: passed.
- `git diff --check`: passed.

Continue after deployment:

- Refresh live `/wxgame/` with a cache-bust query.
- Pan away, click `回到本城`, and capture a screenshot proving the city recenters.
- Start another manual march and verify whether newly explored tiles become visible or require a claim action.
- Keep the unrelated untracked `tools/` directory untouched.

## Completed, Pushed, And Deployed

```text
8de49cce93060794b421b052630153c5a65bc9c3 fix: preserve naming submit promise
1bb8ba95a67841c8de82f3cdafdea9b6e4cb224d fix: keep guided resource highlights visible
f185057f2ec0c2c84b14cbb2eb607518f83fd0d4 fix: preserve guide render target during refresh
fbdc3ca8e30c1514c08bef730df12ae840052411 refactor: add tile topology contracts
712ca9012c867b9880b88692e1f97a4e7d544036 refactor: add large map streaming contracts
```

Behavior fixed:

- Naming submission now prefers the real `game.submitNaming(name)` / `host.submitNaming()` Promise.
- Online playtest now clicks the real naming input target and answers `window.prompt`.
- Guided resource-page highlights now preserve their explicit render target during refreshes.

Verification for deployed `f185057f2ec0c2c84b14cbb2eb607518f83fd0d4`:

```powershell
node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/GameCommandService.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 70 passed
- Architecture gate: 390 passed, stable block guard passed, official document guard passed, `git diff --check` passed
- Full test suite: 757 passed

Deployment checks after `f185057f2ec0c2c84b14cbb2eb607518f83fd0d4`:

- Deploy stamp reported commit `f185057f2ec0c2c84b14cbb2eb607518f83fd0d4`.
- Deploy stamp paths were `/www/wwwroot/h5`.
- API health returned OK.
- Root page still contained `Cocos Creator`.
- Root page still contained `civilization-fire-next-client`.
- Root page did not contain H5 authority markers.
- H5 page contained `authority-state-refresh-v1` and shell runtime markers.

## Online Tutorial Status

Latest strict online playtest:

```powershell
$env:PLAYTEST_GAME_URL='http://47.116.32.216/wxgame/'
$env:PLAYTEST_API_BASE='http://47.116.32.216:3000/api'
$env:PLAYTEST_USERNAME='codexqa'
$env:PLAYTEST_PASSWORD='123456'
$env:PLAYTEST_RESET_ACCOUNT='1'
$env:PLAYTEST_MAX_ACTIONS='160'
$env:PLAYTEST_OUTPUT_DIR='.local-logs/online-tutorial-strict'
npm.cmd run playtest:online-tutorial
```

Output:

```text
E:\Human\wxgame\.local-logs\online-tutorial-strict\2026-06-09T06-41-13-743Z
```

Result:

- `stopReason: tutorial-completed`
- `finalStep: 36`
- `finalStepName: completed`
- `tutorialCompleted: true`
- `actionCount: 56`
- `evidenceCount: 51`
- `verificationReportCount: 58`
- `verificationFailures: []`
- `visualFindings: []`
- `badResponses: []`
- `requestFailures: []`
- `pageErrors: []`
- `apiCallCount: 100`

The online tutorial flow is verified with strict screenshot evidence. The harness now captures before/after full screenshots, target crops, exact target crops, highlight crops, PNG visibility/highlight metrics, center-point hitTarget checks, tutorial shield checks, API/result checks, and authority-envelope checks. Manual screenshot review covered building, world-march target, exploration wait, conquest, and manual talent assignment steps. No active online tutorial blocker remains.

## Current Patch

Backend wrapping-world and AI reveal sync is the current checkpoint. It is locally verified and queued for commit/push in this run; guarded H5 deploy and online browser playtest remain pending after push.

Changed files:

- `backend/services/worldMap/WorldMapConstants.js`
- `backend/services/worldMap/WorldMapTopology.js`
- `backend/services/worldMap/WorldMapShared.js`
- `backend/services/worldMap/WorldMapTiles.js`
- `backend/services/WorldMapService.js`
- `backend/services/WorldAiExplorerService.js`
- `backend/services/GameStateNormalizer.js`
- `backend/services/GameStateMigrationPipeline.js`
- `backend/services/realtime/AoiSyncSnapshot.js`
- `backend/services/territory/TerritoryScoutPlanner.js`
- `backend/services/territory/TerritoryStateNormalizer.js`
- `backend/services/worldExplorer/WorldExplorerRoutePlanner.js`
- `backend/tests/RealtimeAuthorityContract.test.js`
- `backend/tests/WorldExplorerArchitecture.test.js`
- `backend/tests/WorldMapArchitecture.test.js`
- `scripts/run-architecture-smoke.js`
- `docs/current_gameplay_design_2026-06-09.md`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/current_refactor_progress_2026-06-09.md`
- `docs/current_codex_transfer_2026-06-09.md`

Behavior added:

- `WorldMapTopology` adds backend full wrapping torus topology, canonical ids, display ids, wrapped delta/distance, topology metadata, and generation coordinates.
- `WorldMapService` writes `worldQ/worldR/canonicalId` on tiles and merges by canonical id while preserving display `q/r` for current frontend rendering.
- Terrain generation now uses canonical/generation coordinates, so wrapped coordinates such as `-1,0` and `1023,0` produce the same terrain.
- New states use the shared server `DEFAULT_WORLD_SEED`; legacy `world-${playerId}` seeds normalize to the shared world seed.
- `WorldAiExplorerService` adds bounded AI exploration. AI reveal first writes hidden server tiles.
- `getClientWorldMap`, `AoiSyncSnapshot`, `TerritoryStateNormalizer`, `TerritoryScoutPlanner`, and `WorldExplorerRoutePlanner` filter hidden AI tiles so they do not leak into player-visible state or route planning before encounter.
- Encounter sync is server-side and bounded: after AI/player reveal frontiers meet, AI-unlocked terrain syncs to player visibility up to `MAX_SYNC_TILES_PER_PASS`, preserving canonical identity while projecting display coords near player-visible tiles.
- `GameStateNormalizer.normalizeState()` advances AI exploration through the capped service.
- Architecture smoke now syntax-checks `WorldMapTopology.js` and `WorldAiExplorerService.js`.

Focused verification passed:

```powershell
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/WorldMapArchitecture.test.js
```

Results:

- Focused backend regression: 41 passed

Architecture verification passed:

```powershell
npm.cmd run test:architecture
```

Results:

- Architecture gate: 477 passed, stable block guard passed, official document guard passed, `git diff --check` passed

Before deploying or making further edits, rerun if there are changes after this checkpoint:

```powershell
npm.cmd run test:architecture
git diff --check
```

Deployment checks after `712ca9012c867b9880b88692e1f97a4e7d544036`:

- Deploy stamp reported commit `712ca9012c867b9880b88692e1f97a4e7d544036`.
- Deploy stamp paths were `/www/wwwroot/h5`.
- API health returned OK with config version `2.3`.
- Root page still contains `Cocos Creator`.
- Root page still contains `civilization-fire-next-client`.
- Root page does not contain H5 markers such as `WorldChunkAddress` or `authority-state-refresh-v1`.
- H5 page contains `WorldChunkAddress.js?v=architecture-refactor-large-map-contract-v1`.
- H5 page contains `WorldInterestWindow.js?v=architecture-refactor-large-map-contract-v1`.
- H5 page contains `WorldRevealStore.js?v=architecture-refactor-large-map-contract-v1`.

Online tutorial smoke after P11-004 deploy:

```powershell
$env:PLAYTEST_MAX_ACTIONS='140'; npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-09T00-30-51-079Z
```

Result:

- `stopReason: tutorial-completed`
- `finalStep: 36`
- `finalStepName: completed`
- `tutorialCompleted: true`
- `actionCount: 59`
- `evidenceCount: 51`
- `visualFindings: []`
- `badResponses: []`
- `requestFailures: []`
- `pageErrors: []`

## Required Next Actions

1. Deploy only through the guarded H5 deploy path and verify the Cocos root remains untouched.
2. After deploy, run online browser playtest with screenshots. Focus: edge wrapping behavior, manual march reveal, return-home, HUD anchoring, and AI synced reveal if a test state can force encounter.
3. Keep unrelated untracked files untouched unless the user explicitly asks for them.

## After This Patch

Continue long-term architecture plan:

- Frontend large-map adoption: presenter/runtime/renderer consume canonical tile identity, chunk/window/reveal store, and bounded AOI snapshots.
- Multiplayer transport: convert server-side encounter sync and AOI snapshots into real delta delivery.
- Stress checks: hundreds of teams, low-end mobile frame flow, and hidden AI tile filtering.

Do not promote backend `WorldMapTopology`, `WorldAiExplorerService`, `TileCoord`, `WorldTopology`, `TileMapGeometry`, `WorldChunkAddress`, `WorldInterestWindow`, `WorldRevealStore`, realtime authority contracts, `ConfigRegistryContract`, `ServerRandomAuthorityContract`, `WorldMapGenerationAuthority`, or the domain random authority adapters to `stable` yet. They should remain `candidate` until downstream consumers prove the extension surface without churn.
