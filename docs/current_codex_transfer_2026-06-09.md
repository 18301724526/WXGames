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

P11-004 large-map streaming contract is complete, fully verified, committed, pushed, and deployed as `712ca9012c867b9880b88692e1f97a4e7d544036 refactor: add large map streaming contracts`.

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

- `WorldChunkAddress`: pure chunk addressing contract for chunk size, chunk id, chunk coordinate, chunk bounds, tile-to-chunk mapping, and wrapped tile-rect expansion.
- `WorldInterestWindow`: pure visible/preload/AOI window contract, including topology summary, chunk lists, and wrapped edge membership checks.
- `WorldRevealStore`: pure revealed-terrain persistence contract by tile id and chunk id, including materialized chunk ids and serializable output without renderer payloads or full `worldMap`.
- H5 and minigame entrypoints load these contracts after `TileCoord`/`WorldTopology`.
- Architecture smoke includes the new files and tests.

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

- Architecture gate: 413 passed, stable block guard passed, official document guard passed, `git diff --check` passed
- Full test suite: 780 passed

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

1. Commit and push this final documentation update if it has not been committed yet.
2. Continue P11-005 realtime authority contract.
3. Keep `tools/` untracked unless the user explicitly asks for it.

## After This Patch

Continue long-term architecture plan:

- P11-005: Realtime authority contract.
- P11-006: Config/version hardening.

Do not promote `TileCoord`, `WorldTopology`, `TileMapGeometry`, `WorldChunkAddress`, `WorldInterestWindow`, or `WorldRevealStore` to `stable` yet. They should remain `candidate` until realtime authority and downstream presenter/runtime/renderer consumers prove the extension surface.
