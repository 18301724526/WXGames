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

P11-006 config/version/random hardening is complete locally and ready for final full gate plus the next commit/deploy cycle if requested.

Changed files:

- `backend/services/config/ConfigRegistryContract.js`
- `backend/tests/ConfigRegistryContract.test.js`
- `backend/services/random/ServerRandomAuthorityContract.js`
- `backend/tests/ServerRandomAuthorityContract.test.js`
- `backend/services/worldMap/WorldMapGenerationAuthority.js`
- `backend/services/worldMap/WorldMapShared.js`
- `backend/services/worldMap/WorldMapWater.js`
- `backend/services/worldMap/WorldMapTiles.js`
- `backend/services/WorldMapService.js`
- `backend/tests/WorldMapArchitecture.test.js`
- `backend/services/skillGenerator/SkillGeneratorRandomAuthority.js`
- `backend/services/skillGenerator/SkillGeneratorShared.js`
- `backend/services/skillGenerator/SkillGeneratorNormalizer.js`
- `backend/services/skillGenerator/SkillAbilityFactory.js`
- `backend/services/skillGenerator/SkillAbilityKitService.js`
- `backend/tests/SkillGeneratorArchitecture.test.js`
- `backend/services/defenderLeader/DefenderLeaderRandomAuthority.js`
- `backend/services/DefenderLeaderService.js`
- `backend/services/famousPerson/FamousPersonRandomAuthority.js`
- `backend/services/famousPerson/FamousPersonGenerator.js`
- `backend/services/famousPerson/FamousPersonShared.js`
- `backend/services/FamousPersonService.js`
- `backend/tests/FamousPersonArchitecture.test.js`
- `backend/services/taskDefinitions/TaskDefinitionNormalizer.js`
- `backend/config/GameConfig.js`
- `backend/config/EraConfig.js`
- `backend/config/TutorialFlowConfig.js`
- `backend/config/BattleConfig.js`
- `backend/config/TechTreeConfig.js`
- `backend/config/BuildingConfig.js`
- `backend/services/TalentPolicyService.js`
- `backend/tests/TalentPolicyService.test.js`
- `backend/services/territory/TerritoryScoutResults.js`
- `backend/services/territory/TerritoryMilitaryMissions.js`
- `backend/services/TerritoryService.js`
- `backend/tests/TerritoryArchitecture.test.js`
- `scripts/run-architecture-smoke.js`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/current_refactor_progress_2026-06-09.md`
- `docs/current_codex_transfer_2026-06-09.md`

Behavior added:

- `ConfigRegistryContract`: pure config registry/version contract for normalized versions, schema metadata, stable content hashes, entry id uniqueness validation, registry comparison, and recommended version bumps.
- `TaskDefinitionNormalizer` now exposes `schema`, `schemaVersion`, `registry`, `registryValidation`, `registryErrors`, and `registryWarnings` while preserving legacy `version`, `hash`, `tasks`, `errors`, and `summary` fields.
- `BuildingConfig` now exposes `getRegistryMetadata()` and `validateRegistry()` while preserving gameplay accessors.
- `GameConfig`, `EraConfig`, `TutorialFlowConfig`, `BattleConfig`, and `TechTreeConfig` now expose config registry metadata/validation while preserving legacy exports and accessors.
- `ServerRandomAuthorityContract`: pure backend random authority contract for bounded server-owned random roll envelopes, deterministic test injection, and chance-roll metadata.
- `TerritoryScoutResults` now consumes server-authoritative random sources for scout outcome and generated-site template rolls while preserving deterministic test injection.
- `FamousPersonRandomAuthority` now adapts famous-person candidate generation to server-authoritative random sources and records compact candidate `source.randomAuthority` metadata.
- Famous-person candidate generation paths no longer default to `Math.random`; injected deterministic random sources still work for tests.
- `DefenderLeaderRandomAuthority` now adapts defender-leader generation to server-authoritative random sources and records compact leader `source.randomAuthority` metadata.
- Defender-leader generation paths no longer default to `Math.random`; injected deterministic random sources still work for tests.
- `WorldMapGenerationAuthority` now owns deterministic world-map materialization rolls with `authority: server`, `domain: worldMap`, and `mode: seeded-hash`.
- `WorldMapService`, `WorldMapWater`, and `WorldMapTiles` now consume `WorldMapGenerationAuthority.roll01()` for terrain, water, river, and scout-reveal branch materialization while preserving seeded reproducibility.
- `WorldMapShared.random01()` remains as a compatibility wrapper over the authority module.
- `WorldMapService` now attaches compact `generationAuthority` metadata during initial creation and normalization.
- `SkillGeneratorRandomAuthority` adapts ability-kit generation to backend-authoritative random sources and records compact `randomAuthority` metadata for default generated kits.
- Skill generator paths no longer default to `Math.random`; injected deterministic random sources still work for tests.
- `TalentPolicyService.createCustomPolicyId()` now uses backend `crypto.randomBytes()` instead of business-code `Math.random`.
- A business-code `Math.random` scan over backend services/config/tests, frontend JS, and scripts is clean.
- Battle experience/reward output was inspected and is deterministic formula logic in `BattleReports.createExperienceSummary()`, so it is not a random authority migration target until chance drops/rewards are introduced.
- Architecture smoke includes the new config registry, random authority, world-map authority, territory, famous-person, defender-leader, skill-generator, talent-policy, and core config files/tests.

Focused verification already passed:

```powershell
node --test backend/tests/WorldMapArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/TerritoryClientAssembler.test.js backend/tests/BattleArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerDtoMapper.test.js
```

Results:

- Focused combined regression: 72 passed

Additional focused verification already passed:

```powershell
node --test backend/tests/TalentPolicyService.test.js backend/tests/SkillGeneratorArchitecture.test.js backend/tests/FamousPersonArchitecture.test.js backend/tests/TerritoryArchitecture.test.js backend/tests/BattleArchitecture.test.js backend/tests/ServerRandomAuthorityContract.test.js
node --test backend/tests/ConfigRegistryContract.test.js backend/tests/TaskDefinitionArchitecture.test.js backend/tests/TaskDefinitionService.test.js backend/tests/BattleArchitecture.test.js
```

Results:

- Talent/skill random regression: 43 passed
- Core config registry regression: 25 passed

Architecture verification already passed:

```powershell
npm.cmd run test:architecture
```

Results:

- Architecture gate: 457 passed, stable block guard passed, official document guard passed, `git diff --check` passed

After the final phase 6-8 edits, rerun before committing/deploying:

```powershell
npm.cmd run test:architecture
git diff --check
rg -n "Math\.random" backend/services backend/config backend/tests frontend/js scripts --glob '!frontend/js/vendor/**'
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

1. Run final full architecture gate for the completed local P11-006 patch.
2. Commit, push, and deploy P11-006 only if the user asks for this checkpoint to go online.
3. Keep unrelated untracked files untouched unless the user explicitly asks for them.

## After This Patch

Continue long-term architecture plan:

- Future true random-result authority consumers only when new chance/drop domains are introduced.
- Downstream realtime adoption: multiplayer transport, presenter/runtime consumers, and AOI stress checks.

Do not promote `TileCoord`, `WorldTopology`, `TileMapGeometry`, `WorldChunkAddress`, `WorldInterestWindow`, `WorldRevealStore`, realtime authority contracts, `ConfigRegistryContract`, `ServerRandomAuthorityContract`, `WorldMapGenerationAuthority`, or the domain random authority adapters to `stable` yet. They should remain `candidate` until downstream consumers prove the extension surface without churn.
