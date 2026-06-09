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

Latest online playtest:

```powershell
$env:PLAYTEST_MAX_ACTIONS='140'; npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-08T23-54-53-188Z
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

The online tutorial flow is verified with screenshot evidence. No active online tutorial blocker remains.

## Current Patch

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

- `TileCoord`: pure stable coordinate contract using `x/y`, with `q/r` compatibility aliases.
- `WorldTopology`: pure full wrapping torus contract, including coordinate normalization and shortest wrapped delta/distance.
- `TileMapGeometry`: now consumes `TileCoord`, keeps old public projection helpers, and adds `screenPointToCoord()`.
- H5 and minigame entrypoints load `TileCoord` and `WorldTopology` before `TileMapGeometry`.
- Architecture smoke includes the new files and tests.

Verification already passed:

```powershell
node --test frontend/js/domain/TileCoord.test.js frontend/js/domain/WorldTopology.test.js frontend/js/domain/TileMapGeometry.test.js
npm.cmd run test:architecture
npm.cmd test
```

Results:

- Focused tests: 11 passed
- Architecture gate: 401 passed, stable block guard passed, official document guard passed, `git diff --check` passed
- Full test suite: 768 passed

Deployment checks after `fbdc3ca8e30c1514c08bef730df12ae840052411`:

- Deploy stamp reported commit `fbdc3ca8e30c1514c08bef730df12ae840052411`.
- Deploy stamp paths were `/www/wwwroot/h5`.
- API health returned OK.
- Root page still contained `Cocos Creator`.
- Root page still contained `civilization-fire-next-client`.
- Root page did not contain `TileCoord` or `authority-state-refresh-v1`.
- H5 page contained `TileCoord.js?v=architecture-refactor-tile-topology-v1`.
- H5 page contained `WorldTopology.js?v=architecture-refactor-tile-topology-v1`.
- H5 page contained `authority-state-refresh-v1`.

Online tutorial smoke after P11-003 deploy:

```powershell
$env:PLAYTEST_MAX_ACTIONS='140'; npm.cmd run playtest:online-tutorial
```

Output:

```text
F:\AI Project\WXGamesLocal\.local-logs\online-tutorial\2026-06-09T00-09-38-297Z
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

1. Commit and push this documentation update if it is not committed yet.
2. Keep `tools/` untracked unless the user explicitly asks for it.
3. Continue P11-004.

## After This Patch

Continue long-term architecture plan:

- P11-004: Large-map streaming contract.
- P11-005: Realtime authority contract.
- P11-006: Config/version hardening.

Do not promote `TileCoord`, `WorldTopology`, or `TileMapGeometry` to `stable` yet. They should remain `candidate` until P11-004 and later consumers prove the extension surface.
