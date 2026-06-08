# Current Codex Transfer - 2026-06-09

This is the active transfer note for the next Codex session. It is a working note, not a product or architecture authority.

## User Intent

The user wants long-term architecture health to reach the documented target:

- modular, block-like development
- stable lower-level files sealed after completion
- feature iteration through explicit interfaces and extension points
- old stable internals reopened only for bugs, performance, security, contract updates, or governance

The user also wants the online tutorial flow verified with screenshots before deeper refactor work continues.

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

## Completed And Deployed Before This Local Patch

```text
7bb8a034a8d609a54b4c857b44d53c13ffece299 fix: expose world march hud hit targets
056e4c5b05bc08eb7ee8356b10c34783ce1c11d3 fix: refresh world march tutorial highlight
```

Behavior fixed:

- Visible world march HUD action now exports a clickable `openWorldMarchFormationPicker` hit target in the map-home render path.
- Tutorial highlight refreshes after opening the formation picker, so the allowed action switches to `startWorldMarch`.

Verification already completed before the current local patch:

```powershell
node --test frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/WorldMarchHudCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/CanvasGameShell.test.js
node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/CanvasGameShell.test.js
npm.cmd run test:architecture
npm.cmd test
```

All passed before deployment.

## Current Local Patch

Changed files:

- `frontend/js/services/GameStateSync.js`
- `frontend/js/services/GameStateSync.test.js`
- `frontend/js/platform/CanvasGameApp.js`
- `frontend/js/platform/CanvasGameApp.test.js`
- `frontend/index.html`
- `docs/current_refactor_progress_2026-06-09.md`
- `docs/current_codex_transfer_2026-06-09.md`

Behavior added:

- `GameStateSync` keeps `/game/heartbeat` lightweight.
- If a local active world exploration mission reaches `nextStepAt` or `completesAt`, `GameStateSync` performs a throttled `/game/state` authority refresh.
- `CanvasGameApp` wires `syncService.onState` to `applyApiState`, using the existing state application path.
- H5 cache keys for `GameStateSync.js` and `CanvasGameApp.js` now use `authority-state-refresh-v1`.

Focused and full verification already passed:

```powershell
node --test frontend/js/services/GameStateSync.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasGameShell.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused test: 58 passed
- Architecture gate: 380 passed, stable block guard passed, official document guard passed, `git diff --check` passed
- Full test: 744 passed

## Current Online Tutorial Status

Latest online playtest:

```powershell
npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-08T21-10-00-214Z
```

Result:

- `stopReason: max-actions-reached`
- `finalStep: 24`
- `finalStepName: scoutExploreStarted`
- `tutorialCompleted: false`
- `visualFindings: []`
- `badResponses: []`
- `requestFailures: []`
- `pageErrors: []`

Positive evidence:

- The earlier `openWorldMarchFormationPicker` blocker is fixed.
- The earlier `startWorldMarch` highlight blocker is fixed.
- Step 23 successfully advances into `scoutExploreStarted`.
- Screenshot crops are nonblank.

Current issue:

- While waiting on step 24, the client did not pull `/game/state`; logs only showed `/version`.
- The active mission stayed stale in local state even though server authority should advance exploration progress when `/game/state` is called.
- The current local patch is intended to fix exactly this by refreshing server authority state at world exploration timing boundaries.

## Required Next Actions

1. Commit the current patch.
2. Push to `origin/main`.
3. Push to `private/main` to deploy.
4. Verify:
   - `http://47.116.32.216/wxgame/.wxgame-deploy-version.json`
   - `http://47.116.32.216:3000/api/health`
   - `http://47.116.32.216/` still contains `Cocos Creator`
   - `http://47.116.32.216/` still contains `civilization-fire-next-client`
5. Rerun `npm.cmd run playtest:online-tutorial`.
6. Update both current working docs with the new result.

## After Tutorial Verification

Continue long-term architecture plan:

- P11-003: Tile topology contract.
- P11-004: Large-map streaming contract.
- P11-005: Realtime authority contract.
- P11-006: Config/version hardening.

Keep every stable promotion reflected in:

- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`
