# Current Codex Transfer - 2026-06-09

This is the active transfer note for the next Codex session. It is a working note, not a product or architecture authority.

## User Intent

The user wants long-term architecture health to reach the documented target:

- modular, block-like development
- stable lower-level files sealed after completion
- feature iteration through explicit interfaces and extension points
- old stable internals reopened only for bugs, performance, security, contract updates, or governance

The user also wants the online tutorial flow verified with screenshots before deeper refactor work continues. They explicitly asked to keep this transfer note and the progress note accurate because another Codex session may continue the work later.

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

## Completed, Pushed, And Deployed

```text
7bb8a034a8d609a54b4c857b44d53c13ffece299 fix: expose world march hud hit targets
056e4c5b05bc08eb7ee8356b10c34783ce1c11d3 fix: refresh world march tutorial highlight
6d0680bb0b0822ec95d41d7b314155fbcddb2b75 fix: refresh authority state for world exploration
```

Behavior fixed so far:

- Visible world march HUD action now exports a clickable `openWorldMarchFormationPicker` hit target in the map-home render path.
- Tutorial highlight refreshes after opening the formation picker, so the allowed action switches to `startWorldMarch`.
- `GameStateSync` can refresh `/game/state` when world exploration reaches `nextStepAt` or `completesAt`.
- `CanvasGameApp` can apply refreshed authority state through the existing `applyApiState` path.

Verification for the deployed `6d0680bb0b0822ec95d41d7b314155fbcddb2b75` commit:

```powershell
node --test frontend/js/services/GameStateSync.test.js frontend/js/platform/CanvasGameApp.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/platform/CanvasGameShell.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 58 passed
- Architecture gate: 380 passed
- Full test suite: 744 passed

Deployment protection checks already passed for `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`:

- Deploy stamp reported commit `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`.
- Deploy stamp paths were `/www/wwwroot/h5`.
- API health returned OK.
- Root page still contained `Cocos Creator`.
- Root page still contained `civilization-fire-next-client`.
- H5 page contained `authority-state-refresh-v1`.

## Current Local Patch

Changed files:

- `frontend/app.js`
- `frontend/index.html`
- `frontend/js/ui/H5GameHostSync.test.js`
- `docs/current_refactor_progress_2026-06-09.md`
- `docs/current_codex_transfer_2026-06-09.md`

Behavior added:

- `H5GameHost.init()` now wires the newly created H5 `GameStateSync` instance to `applyApiState` through `onState`.
- `H5GameHost.init()` now provides the current frontend state to that same sync service through `setStateProvider(() => this.state)`.
- The state-provider wiring is repeated after `gameModules.mount()` as a guard against module replacement during host mounting.
- `frontend/index.html` now cache-busts `app.js` with `authority-state-refresh-v1`.
- New test `frontend/js/ui/H5GameHostSync.test.js` proves this H5-specific wiring exists after host initialization.

Focused and full verification already passed for this local patch:

```powershell
node --test frontend/js/ui/H5GameHostSync.test.js frontend/js/services/GameStateSync.test.js frontend/js/platform/CanvasGameApp.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 8 passed
- Architecture gate: 380 passed, stable block guard passed, official document guard passed, `git diff --check` passed
- Full test suite: 745 passed

## Current Online Tutorial Status

Latest online playtest after deployed commit `6d0680bb0b0822ec95d41d7b314155fbcddb2b75`:

```powershell
npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-08T21-21-50-653Z
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

- While waiting on step 24, the client still did not pull `/game/state`; logs only showed `/version`.
- The active world exploration mission stayed stale in local state.
- Root cause: the H5 host creates a replacement `GameStateSync` in `frontend/app.js`, but before this local patch it did not wire `onState` or `setStateProvider` on that replacement service.
- The current local patch is intended to fix exactly this.

## Required Next Actions

1. Stage only:
   - `frontend/app.js`
   - `frontend/index.html`
   - `frontend/js/ui/H5GameHostSync.test.js`
   - `docs/current_refactor_progress_2026-06-09.md`
   - `docs/current_codex_transfer_2026-06-09.md`
2. Commit with message: `fix: wire h5 authority state refresh`.
3. Push to `origin/main`.
4. Push to `private/main` to deploy.
5. Verify:
   - `http://47.116.32.216/wxgame/.wxgame-deploy-version.json`
   - `http://47.116.32.216:3000/api/health`
   - `http://47.116.32.216/` still contains `Cocos Creator`
   - `http://47.116.32.216/` still contains `civilization-fire-next-client`
   - `http://47.116.32.216/wxgame/` contains `app.js?v=authority-state-refresh-v1`
6. Rerun `npm.cmd run playtest:online-tutorial`.
7. Update both current working docs with the new result.

## If Step 24 Still Blocks

Inspect in this order:

1. Whether `/game/state` appears in the latest playtest `requestLogs`.
2. Whether `GameStateSync.start()` is running through `startHeartbeat`.
3. Whether `syncService.getLocalState()` returns `window.Game.state` at runtime.
4. Whether server timing advances active exploration missions only when `/game/state` is called.
5. Whether the tutorial expects `readyMissions` but the server returns another mission shape.

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
