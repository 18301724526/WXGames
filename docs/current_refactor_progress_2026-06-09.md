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
- Latest architecture commit pushed and deployed: `94bf97ad94f72ff696d3c285e5c3bdafcc2d4107`
- Current architecture patch: P11-005 realtime authority contract, committed as `refactor: add realtime authority contracts`, pushed to `origin/main` and `github/main`, and deployed to the H5 path.
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

Deployment verification after `94bf97ad94f72ff696d3c285e5c3bdafcc2d4107`:

- `/wxgame/.wxgame-deploy-version.json`
  - `commit`: `94bf97ad94f72ff696d3c285e5c3bdafcc2d4107`
  - `workTree`: `/www/wwwroot/h5`
  - `frontendPublicDir`: `/www/wwwroot/h5`
- `http://47.116.32.216:3000/api/health` returned OK with config version `2.3`.
- `http://47.116.32.216/` still contains `Cocos Creator`.
- `http://47.116.32.216/` still contains `civilization-fire-next-client`.
- `http://47.116.32.216/` does not contain `authority-state-refresh-v1`.
- `http://47.116.32.216/wxgame/` contains `authority-state-refresh-v1`.
- `http://47.116.32.216/wxgame/` contains `CanvasGameShell`.
- `http://47.116.32.216/wxgame/js/api/GameAPI.js` contains intent-only `stopWorldMarch(missionId)`.

Online tutorial smoke after P11-005 deploy:

```powershell
$env:PLAYTEST_GAME_URL='http://47.116.32.216/wxgame/'
$env:PLAYTEST_API_BASE='http://47.116.32.216:3000/api'
$env:PLAYTEST_MAX_ACTIONS='140'
npm.cmd run playtest:online-tutorial
```

Output:

```text
E:\Human\wxgame\.local-logs\online-tutorial-p11-005\2026-06-09T05-53-55-099Z
```

Result:

- Stop reason: `tutorial-completed`
- Final tutorial step: `36`
- Final step name: `completed`
- Tutorial completed: `true`
- Action count: `64`
- Evidence count: `51`
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none

## Strict Browser Tutorial Visual QA

Current local patch:

- `scripts/playtest-online-tutorial.js` now treats tutorial browser playtest as a strict player-visible acceptance gate.
- The harness captures before/after full screenshots, target crops, exact target crops, and tutorial highlight crops for guided actions.
- The harness uses `pngjs` to analyze PNG evidence for target visibility, crop variance, and guided gold-highlight pixels.
- The harness checks center-point hitTargets, tutorial shield allowance, API success, expected state/action outcomes, and server-owned authority envelopes for world-march/conquest flows.
- The harness writes `summary.json`, `verification-report.json`, `manualReviewIndex`, `verificationReports`, and `verificationFailures`.
- Direct internal state-push fallbacks were removed for player-visible tutorial steps; missing visible/clickable targets fail the run.

Final strict online run:

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

- Stop reason: `tutorial-completed`
- Final tutorial step: `36`
- Final step name: `completed`
- Tutorial completed: `true`
- Action count: `56`
- Evidence count: `51`
- Verification report count: `58`
- Verification failures: none
- Visual findings: none
- Bad responses: none
- Request failures: none
- Page errors: none
- Captured API calls: `100`

Manual screenshot review completed for:

- `highlight-buildBuilding-6-before-full.png`
- `highlight-selectWorldMarchTarget-38-before-full.png`
- `wait-explore-41-before-full.png`
- `highlight-conquer-46-before-full.png`
- `highlight-assignJob-52-before-full.png`

Manual review result:

- Guided building, world-march target, exploration wait state, conquest button, and manual talent assignment button are visibly highlighted and player-clickable in the screenshots.
- The strict run no longer uses code-level success as a substitute for player-visible evidence.

P11-005 deployed status:

- Complete, committed, pushed, deployed, and online verified.

P11-006 phase 1 status:

- Complete locally.
- Added `ConfigRegistryContract` as the candidate config registry/version contract.
- `TaskDefinitionNormalizer` and `BuildingConfig` now expose registry metadata/validation while preserving legacy behavior.
- Focused regression passed: `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js`.
- Architecture gate passed with 424 tests at phase 1: `npm.cmd run test:architecture`.

P11-006 phase 2 status:

- Complete locally.
- Added `ServerRandomAuthorityContract` as the candidate backend random authority contract.
- `TerritoryScoutResults` now consumes server-authoritative random sources for scout outcome and generated-site template rolls while preserving deterministic test injection.
- `TerritoryService` and `TerritoryMilitaryMissions` no longer use default `Math.random` for scout result paths.
- Focused regression passed: `node --test backend/tests/ServerRandomAuthorityContract.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/TerritoryClientAssembler.test.js backend/tests/TerritoryActionTutorial.test.js backend/tests/ConfigRegistryContract.test.js`.
- Architecture gate passed with 444 tests: `npm.cmd run test:architecture`.

P11-006 phase 3 status:

- Complete locally.
- Added `FamousPersonRandomAuthority` as the famous-person random authority adapter.
- Famous-person candidate generation now consumes backend-authoritative random sources by default and records compact `source.randomAuthority` metadata while preserving deterministic test injection.
- `FamousPersonGenerator` / `FamousPersonShared` no longer use default `Math.random` in candidate generation paths.
- Focused regression passed with 48 tests: `node --test backend/tests/ServerRandomAuthorityContract.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js`.
- Architecture gate passed with 450 tests: `npm.cmd run test:architecture`.

P11-006 phase 4 status:

- Complete locally.
- Added `DefenderLeaderRandomAuthority` as the defender-leader random authority adapter.
- Defender-leader generation now consumes backend-authoritative random sources by default and records compact `source.randomAuthority` metadata while preserving deterministic test injection.
- `DefenderLeaderService` no longer uses default `Math.random` in defender-leader generation paths.
- Focused regression passed with 58 tests: `node --test backend/tests/ServerRandomAuthorityContract.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/TerritoryClientAssembler.test.js backend/tests/BattleArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js`.
- Architecture gate passed with 451 tests: `npm.cmd run test:architecture`.

P11-006 phase 5 status:

- Complete locally.
- Added `WorldMapGenerationAuthority` as the world-map deterministic materialization authority.
- `WorldMapService`, `WorldMapWater`, and `WorldMapTiles` now consume `roll01()` from the world-map authority for seeded terrain, water, river, and scout-reveal branch rolls while preserving existing deterministic map output semantics.
- `WorldMapShared.random01()` remains as a compatibility wrapper over `WorldMapGenerationAuthority.roll01()` so old callers do not need to fork the random/hash algorithm.
- `createInitialWorldMap()` and `normalizeWorldMap()` now attach compact `generationAuthority` metadata with `authority: server`, `domain: worldMap`, and `mode: seeded-hash`.
- Battle rewards were inspected: current battle experience/reward output is deterministic formula logic in `BattleReports.createExperienceSummary()`, so it is not a random authority migration target until chance rewards/drops are introduced.
- Focused regression passed with 72 tests: `node --test backend/tests/WorldMapArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/TerritoryClientAssembler.test.js backend/tests/BattleArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerDtoMapper.test.js`.
- Architecture gate passed with 457 tests: `npm.cmd run test:architecture`.

P11-006 phase 6 status:

- Complete locally.
- Added `SkillGeneratorRandomAuthority` as the skill/ability-kit random authority adapter.
- `SkillAbilityKitService`, `SkillAbilityFactory`, `SkillGeneratorNormalizer`, and `SkillGeneratorShared` no longer default to `Math.random`; default generation consumes backend-authoritative random sources and deterministic test injection remains supported.
- Ability kits generated through the default authority now include compact `randomAuthority` metadata; explicitly injected deterministic sources preserve legacy test payloads without extra metadata.
- Focused regression passed with 64 tests: `node --test backend/tests/SkillGeneratorArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/BattleArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js backend/tests/WorldMapArchitecture.test.js backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js`.

P11-006 phase 7 status:

- Complete locally.
- Core backend config domains now expose `raw()`, `getVersion()`, `getSourcePath()`, `getRegistryMetadata()`, and `validateRegistry()` where applicable:
  - `backend/config/GameConfig.js`
  - `backend/config/EraConfig.js`
  - `backend/config/TutorialFlowConfig.js`
  - `backend/config/BattleConfig.js`
  - `backend/config/TechTreeConfig.js`
  - existing `backend/config/BuildingConfig.js`
- `scripts/run-architecture-smoke.js` now syntax-checks those config modules as part of `npm.cmd run test:architecture`.
- Focused config regression passed with 25 tests: `node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js backend/tests/BattleArchitecture.test.js`.

P11-006 phase 8 status:

- Complete locally.
- `TalentPolicyService.createCustomPolicyId()` now uses backend `crypto.randomBytes()` instead of business-code `Math.random`.
- `backend/tests/TalentPolicyService.test.js` covers deterministic custom policy id formatting plus generated/explicit custom policy save behavior.
- Business-code random scan is clean: `rg -n "Math\.random" backend/services backend/config backend/tests frontend/js scripts --glob '!frontend/js/vendor/**'` returns no matches.
- Focused talent/skill random regression passed with 43 tests: `node --test backend/tests/TalentPolicyService.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/BattleArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js`.

## Next Architecture Work

After P11-006 local completion, continue:

1. Run final full architecture gate and whitespace check for the complete local P11-006 patch.
2. Downstream realtime adoption: multiplayer transport, presenter/runtime consumers, and AOI stress checks.
3. Stable promotion observation: keep P11 modules as `candidate` until downstream consumers prove extension surfaces without churn.
4. Keep the strict browser tutorial visual QA harness as the acceptance gate for future tutorial/hitTarget/highlight/deploy-risk changes.

Do not promote the new tile topology, large-map streaming, realtime authority, config registry, or random authority modules to `stable` yet. They are `candidate` until downstream presenter/runtime/renderer, multiplayer transport, and config-update consumers prove the extension surface without churn.

Final P11-006 full gate:

```powershell
npm.cmd run test:architecture
rg -n "Math\.random" backend/services backend/config backend/tests frontend/js scripts --glob '!frontend/js/vendor/**'
```

Results:

- Architecture gate: 467 passed
- Stable block manifest guard: passed
- Official document guard: passed
- `git diff --check`: passed
- Business-code `Math.random` scan: clean

Current overall refactor progress estimate: `100%` for the documented P0-P11 architecture refactor scope. Remaining work is follow-up adoption/observation, not incomplete refactor scope.
