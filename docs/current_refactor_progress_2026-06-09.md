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
- Latest committed, pushed, and deployed commit before the current local patch: `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`
- Latest deployed fixes:
  - `7bb8a034a8d609a54b4c857b44d53c13ffece299 fix: expose world march hud hit targets`
  - `056e4c5b05bc08eb7ee8356b10c34783ce1c11d3 fix: refresh world march tutorial highlight`
  - `6d0680bb0b0822ec95d41d7b314155fbcddb2b75 fix: refresh authority state for world exploration`
- Current local patch, not committed yet:
  - `frontend/app.js`
  - `frontend/index.html`
  - `frontend/js/ui/H5GameHostSync.test.js`
  - `docs/current_refactor_progress_2026-06-09.md`
  - `docs/current_codex_transfer_2026-06-09.md`
- Online H5 URL: `http://47.116.32.216/wxgame/`
- Protected Cocos root: `http://47.116.32.216/`
- Unrelated untracked `tools/` exists and must remain untouched unless the user explicitly asks for it.

## Verified And Deployed So Far

After `7bb8a034a8d609a54b4c857b44d53c13ffece299`:

- Fixed the visible world march HUD `行军` button hit target.

After `056e4c5b05bc08eb7ee8356b10c34783ce1c11d3`:

- Fixed stale tutorial highlight after opening the world march formation picker.

After `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`:

- Added `GameStateSync` authority refresh at world exploration timing boundaries.
- Wired `CanvasGameApp` to apply refreshed authority state through `applyApiState`.
- Updated `frontend/index.html` cache keys for `GameStateSync.js` and `CanvasGameApp.js` to `authority-state-refresh-v1`.

Verification for `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`:

```powershell
node --test frontend/js/services/GameStateSync.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasGameShell.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 58 passed
- Architecture gate: 380 passed
- Stable block manifest guard: passed
- Official document guard: passed
- `git diff --check`: passed
- Full test suite: 744 passed

Deployment verification after `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`:

- `/wxgame/.wxgame-deploy-version.json`
  - `commit`: `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`
  - `workTree`: `/www/wwwroot/h5`
  - `frontendPublicDir`: `/www/wwwroot/h5`
- `http://47.116.32.216:3000/api/health` returned OK.
- `http://47.116.32.216/` still contains `Cocos Creator`.
- `http://47.116.32.216/` still contains `civilization-fire-next-client`.
- `http://47.116.32.216/wxgame/` contains `authority-state-refresh-v1`.

## Online Tutorial Playtest After Deployed Commit `6d0680bb`

Command:

```powershell
npm.cmd run playtest:online-tutorial
```

Latest completed run directory:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-08T21-21-50-653Z
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
  - Previous blocker fixed: `highlight-openWorldMarchFormationPicker-37`
  - Previous blocker fixed: `highlight-startWorldMarch-38`
  - Step 23 successfully advanced into `scoutExploreStarted`.
  - Screenshot crops were nonblank.
- Remaining blocker:
  - While waiting on step 24, the playtest still saw only `/version` in `requestLogs` and no `/game/state`.
  - Final state still had an active manual exploration mission with unrevealed route state.
  - Root cause found in H5 host wiring: `frontend/app.js` creates a new `GameStateSync` inside `H5GameHost.init()`, replacing the constructor-time service. The replacement service only had heartbeat, connection, and error handlers wired, so it had no `onState` callback and no local state provider.

## Current Local Patch Verification

Current local patch behavior:

- `frontend/app.js` wires the H5-created `GameStateSync` to:
  - `onState = (data) => this.applyApiState(data)`
  - `setStateProvider(() => this.state)`
- The same state-provider wiring is repeated after `gameModules.mount()` as a defensive guard against module mount replacement.
- `frontend/index.html` updates `app.js` to the `authority-state-refresh-v1` cache key.
- `frontend/js/ui/H5GameHostSync.test.js` verifies that H5 host initialization wires authority state refresh after replacing the constructor sync service.

Verification already passed for this local patch:

```powershell
node --test frontend/js/ui/H5GameHostSync.test.js frontend/js/services/GameStateSync.test.js frontend/js/platform/CanvasGameApp.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 8 passed
- Architecture gate: 380 passed
- Stable block manifest guard: passed
- Official document guard: passed
- `git diff --check`: passed
- Full test suite: 745 passed

## Next Required Gates

Before continuing deeper architecture work:

1. Commit the current local patch.
2. Push to `origin/main`.
3. Push to `private/main` to deploy.
4. Verify deployment stamp, API health, and Cocos root protection.
5. Rerun `npm.cmd run playtest:online-tutorial`.
6. Update this document and `docs/current_codex_transfer_2026-06-09.md` with the new online result.

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
