# Frontend ECS Migration Progress - 2026-06-25

## Current Status

| Field                  | Value                                        |
| ---------------------- | -------------------------------------------- |
| Branch                 | `codex/refactor-tutorial-guide-architecture` |
| Current batch          | `4. Input Intent Boundary`                   |
| Batch state            | `Planning (docs only, no code)`              |
| Runtime code migration | Mode ownership bridge only                   |
| ECS dependency         | `bitecs@0.4.0` installed exactly             |
| Last updated           | `2026-06-25 23:29:18 +08:00`                 |

## Batch 0A Checklist

| Step                                          | Status    | Completed At                 | Evidence                                                                                                                                                                                                            |
| --------------------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0A-1. Produce mode boolean inventory          | Completed | `2026-06-25 13:14:11 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md`                                                                                                                                       |
| 0A-2. Produce bridge inventory                | Completed | `2026-06-25 13:14:11 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0a-bridge-shrink-baseline.md`                                                                                                                                        |
| 0A-3. Deploy mode ownership report-only guard | Completed | `2026-06-25 13:14:11 +08:00` | `scripts/report-frontend-ecs-mode-ownership.js`                                                                                                                                                                     |
| 0A-4. Deploy bridge shrink report-only guard  | Completed | `2026-06-25 13:14:11 +08:00` | `scripts/report-frontend-ecs-bridge-shrink.js`                                                                                                                                                                      |
| 0A-5. Migration owner review                  | Completed | `2026-06-25 14:01:38 +08:00` | `codex/external-review` approved the 0A baseline for completion                                                                                                                                                     |
| 0A-6. Update progress document                | Completed | `2026-06-25 14:01:38 +08:00` | This file records 0A as completed after review                                                                                                                                                                      |
| 0A-7. Update operating plan                   | Completed | `2026-06-25 14:01:38 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md` records 0A as completed                                                                                                                 |
| 0A-8. Commit and server branch push           | Completed | `2026-06-25 14:53:09 +08:00` | Completion, deploy-gate formatting, and deploy evidence commits were pushed to `origin/codex/refactor-tutorial-guide-architecture`; refactor test server deployed commit `8ebedeb48d7ea3220ee35233f084a24e3a270761` |

## Report-Only Guard Baseline

| Guard                    | Files Scanned |             Findings / Candidates | Blocking?       | Command                                                            |
| ------------------------ | ------------: | --------------------------------: | --------------- | ------------------------------------------------------------------ |
| Mode ownership guard     |           213 |          960 findings, 25 symbols | No, report-only | `node scripts/report-frontend-ecs-mode-ownership.js --summary`     |
| Bridge shrink guard      |           213 | 39 candidates, 1911 branch tokens | No, report-only | `node scripts/report-frontend-ecs-bridge-shrink.js --summary`      |
| Renderer authority guard |            97 |                      315 findings | No, report-only | `node scripts/report-frontend-ecs-renderer-authority.js --summary` |
| Input branch guard       |            14 |                      203 findings | No, report-only | `node scripts/report-frontend-ecs-input-branch.js --summary`       |
| Literal duplicate guard  |           213 |                    10417 findings | No, report-only | `node scripts/report-frontend-ecs-literal-duplicate.js --summary`  |
| ECS core guard           |           218 |                      0 violations | Yes, blocking   | `node scripts/check-frontend-ecs-core-guard.js`                    |
| ECS boundary guard       |           222 |                      0 violations | Yes, blocking   | `node scripts/check-frontend-ecs-boundary-skeleton.js`             |
| ECS mode spine guard     |           222 |                      0 violations | Yes, blocking   | `node scripts/check-frontend-ecs-mode-ownership-spine.js`          |

## Batch 0B Checklist

| Step                                 | Status    | Updated At                   | Evidence                                                                                                                                       |
| ------------------------------------ | --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0B-1. Renderer authority report      | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0b-renderer-authority-baseline.md`                                                              |
| 0B-2. Input branch report            | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0b-input-branch-baseline.md`                                                                    |
| 0B-3. Literal / duplicate report     | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0b-literal-duplicate-baseline.md`                                                               |
| 0B-4. Guard tests                    | Completed | `2026-06-25 16:43:55 +08:00` | New `node:test` coverage for renderer authority, input branch, and literal duplicate guards                                                    |
| 0B-5. Architecture smoke integration | Completed | `2026-06-25 16:43:55 +08:00` | `scripts/run-architecture-smoke.js` runs all 0A and 0B report-only guards with `--summary`                                                     |
| 0B-6. Progress document update       | Completed | `2026-06-25 16:43:55 +08:00` | This document records 0B commands, artifacts, status, and migration owner review completion                                                    |
| 0B-7. Operating plan update          | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md` records 0B completed                                               |
| 0B-8. Commit and push                | Completed | `2026-06-25 16:43:55 +08:00` | Commit `b3454765` reached the server branch; refactor test server deploy was manually completed with the same wrapper after push-side HTTP 504 |

## Batch 1 Checklist

| Step                                | Status    | Updated At                   | Evidence                                                                                                                                       |
| ----------------------------------- | --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-1. ECS core ADR                   | Completed | `2026-06-25 18:33:08 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-batch-1-core-adr.md` selects `bitecs` and records Batch 1 non-goals                             |
| 1-2. ECS core blocking guard        | Completed | `2026-06-25 18:33:08 +08:00` | `scripts/check-frontend-ecs-core-guard.js` blocks local ECS core primitives and non-`bitecs` ECS packages                                      |
| 1-3. Guard tests                    | Completed | `2026-06-25 18:33:08 +08:00` | `scripts/check-frontend-ecs-core-guard.test.js` covers scan scope, allowed imports, blocked local core patterns, and CLI behavior              |
| 1-4. Architecture smoke integration | Completed | `2026-06-25 18:33:08 +08:00` | `scripts/run-architecture-smoke.js` runs the ECS core guard as a blocking gate                                                                 |
| 1-5. Progress document update       | Completed | `2026-06-25 18:33:08 +08:00` | This document records Batch 1 artifacts, commands, status, and review blocker                                                                  |
| 1-6. Commit and server branch push  | Completed | `2026-06-25 18:33:08 +08:00` | Commit `22bf9106` reached the server branch; refactor test server deploy was manually completed with the same wrapper after push-side HTTP 504 |
| 1-7. Migration owner review         | Completed | `2026-06-25 18:33:08 +08:00` | `codex/external-review` approved Batch 1 for completion                                                                                        |

## Batch 2 Checklist

| Step                                | Status    | Updated At                   | Evidence                                                                                                                                              |
| ----------------------------------- | --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2-1. Exact ECS dependency pin       | Completed | `2026-06-25 20:16:29 +08:00` | `package.json` and `package-lock.json` pin `bitecs` to exact version `0.4.0`; `npm ls bitecs` resolves `bitecs@0.4.0`                                 |
| 2-2. ECS core boundary skeleton     | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/core/EcsCoreBoundary.js` is the only production boundary touching `bitecs`; it forwards approved primitives without local core logic |
| 2-3. ECS manifest skeleton          | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/registry/EcsBoundaryManifest.js` declares owner roles, component families, mode keys, snapshot keys, and bridge lifecycle policy     |
| 2-4. Boundary documentation         | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/README.md` states Batch 2 is a Node/CommonJS architecture boundary and is not loaded by H5 or minigame entrypoints                   |
| 2-5. Boundary blocking guard        | Completed | `2026-06-25 20:16:29 +08:00` | `scripts/check-frontend-ecs-boundary-skeleton.js` blocks direct `bitecs` imports outside the boundary, ECS reverse dependencies, and runtime loading  |
| 2-6. Guard and skeleton tests       | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/**/*.test.js` and `scripts/check-frontend-ecs-boundary-skeleton.test.js` cover boundary exports, manifest facts, and guard behavior  |
| 2-7. Architecture smoke integration | Completed | `2026-06-25 20:16:29 +08:00` | `scripts/run-architecture-smoke.js` checks new ECS files/tests and runs the boundary guard as blocking                                                |
| 2-8. Commit and server branch push  | Completed | `2026-06-25 20:16:29 +08:00` | Commit `08acdf88` reached the server branch; refactor test server manual deploy completed and health confirmed deployed commit `08acdf88`             |

Batch 2 notes:

- `bitecs@0.4.0` exposes the planned `defineComponent`, `Types`, `defineQuery`, `enterQuery`, and `exitQuery` API through the official `bitecs/legacy` export. This surface is allowed only inside `frontend/js/ecs/core/EcsCoreBoundary.js`.
- `bitecs/serialization` remains an approved external ECS surface in the Batch 1 ADR, but Batch 2 code does not import it yet.
- `frontend/index.html` and `frontend/minigame/game.js` are not modified and do not load `frontend/js/ecs`.

## Batch 3 Checklist

| Step                                    | Status    | Updated At                   | Evidence                                                                                                                                                                                                                        |
| --------------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-1. Mode ECS owner modules             | Completed | `2026-06-25 21:01:23 +08:00` | `frontend/js/ecs/mode/ModeKeys.js`, `ModeComponents.js`, `ModeResolver.js`, `ModeWorld.js`, and `EcsModeRuntimeEntry.js` create the singleton mode owner and frozen snapshot                                                    |
| 3-2. Generated runtime bundle           | Completed | `2026-06-25 21:01:23 +08:00` | `scripts/build-frontend-ecs-runtime.js` builds `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` with exact `esbuild@0.23.1`                                                                                                    |
| 3-3. Legacy mode bridge                 | Completed | `2026-06-25 21:01:23 +08:00` | `frontend/js/platform/CanvasModeOwnershipBridge.js` reads legacy app/shell fields as ingress facts and exposes mode snapshot helpers                                                                                            |
| 3-4. App/Shell centralized mode routing | Completed | `2026-06-25 21:01:23 +08:00` | `CanvasGameAppInputRouter.js` and `CanvasGameShellInputRouter.js` prefer mode snapshot helpers for blocking overlay, entity battle, world map, and tech-tree route decisions                                                    |
| 3-5. H5/minigame runtime loading        | Completed | `2026-06-25 21:01:23 +08:00` | `frontend/index.html` and `frontend/minigame/game.js` load only the generated ECS mode runtime bundle plus `CanvasModeOwnershipBridge.js`                                                                                       |
| 3-6. Blocking guards                    | Completed | `2026-06-25 21:01:23 +08:00` | `scripts/check-frontend-ecs-mode-ownership-spine.js` blocks legacy mode-decision growth; boundary guard now allows only the approved runtime bundle                                                                             |
| 3-7. Guard and behavior tests           | Completed | `2026-06-25 21:01:23 +08:00` | Mode world, bridge, boundary guard, mode spine guard, script manifest, and App/Shell focused tests pass locally                                                                                                                 |
| 3-8. Progress / operating plan update   | Completed | `2026-06-25 21:01:23 +08:00` | This document and `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md` record Batch 3 as Completed                                                                                                       |
| 3-9. Commit and server branch push      | Completed | `2026-06-25 23:02:25 +08:00` | Implementation commits `8969451a` and `51d3b265` reached the server branch; refactor test server manual deploy passed the gate and health returned `status: ok` with deployed commit `51d3b2657a35dfac2b206b3bfbe9761c03f4bf2d` |
| 3-10. Migration owner review            | Completed | `2026-06-25 23:02:25 +08:00` | `codex/external-review` signed off the Batch 3 mode ownership spine; this completion commit marks Batch 3 as Completed                                                                                                          |

Batch 3 notes:

- The new mode owner is `frontend/js/ecs/mode/ModeWorld.js`; it owns a singleton ECS mode entity.
- `CanvasModeOwnershipBridge.js` is a temporary bridge and only derives serializable facts from old fields. It does not own concrete modal payloads.
- Generic blocking overlays still treat the tech command panel as blocking, while tech-tree routing uses `techTreeBlockingOverlayActive` to preserve the old `hasBlockingOverlayExceptTechTree()` behavior.
- Batch 3 does not migrate physical input intent, concrete modal ownership, renderer snapshot contracts, gameplay domain state, or tutorial flow ownership.

## Verification Commands

Executed before this progress entry:

- `node --test scripts/report-frontend-ecs-mode-ownership.test.js`
- `node --test scripts/report-frontend-ecs-bridge-shrink.test.js`
- `node scripts/report-frontend-ecs-mode-ownership.js --summary`
- `node scripts/report-frontend-ecs-bridge-shrink.js --summary`

Executed before commit/push:

- `node --test scripts/report-frontend-ecs-renderer-authority.test.js`
- `node --test scripts/report-frontend-ecs-input-branch.test.js`
- `node --test scripts/report-frontend-ecs-literal-duplicate.test.js`
- `node scripts/report-frontend-ecs-renderer-authority.js --summary`
- `node scripts/report-frontend-ecs-input-branch.js --summary`
- `node scripts/report-frontend-ecs-literal-duplicate.js --summary`
- `npm run format:check`
- `npm run test:architecture`
- `git diff --check`
- `git status --short`

Executed for Batch 1 before this progress entry:

- `node --test scripts/check-frontend-ecs-core-guard.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-core-guard.js --json`
- `npm run format:check`
- `npm run test:architecture`
- `git diff --check`

Executed for Batch 2 before this progress entry:

- `npm ls bitecs`
- `node --test frontend/js/ecs/**/*.test.js`
- `node --test scripts/check-frontend-ecs-boundary-skeleton.test.js`
- `node --test scripts/check-frontend-ecs-core-guard.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-core-guard.js --json`
- `node scripts/check-frontend-ecs-boundary-skeleton.js`
- `node scripts/check-frontend-ecs-boundary-skeleton.js --json`
- `npm run format:check`
- `npm run test:architecture`

Batch 2 local verification result:

- `npm ls bitecs`: passed, resolved `bitecs@0.4.0`.
- ECS skeleton tests: passed, 7 tests.
- Boundary guard tests: passed, 8 tests.
- ECS core guard: passed, 0 violations.
- ECS boundary guard: passed, 0 violations across 222 scanned files.
- `npm run format:check`: passed.
- `npm run test:architecture`: passed, 1140 tests and all architecture guards.

Executed for Batch 3 before this progress entry:

- `npm run build:ecs-runtime`
- `node --test frontend/js/ecs/mode/**/*.test.js`
- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js`
- `node --test scripts/check-frontend-ecs-boundary-skeleton.test.js`
- `node --test scripts/check-frontend-ecs-mode-ownership-spine.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-boundary-skeleton.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js`
- `node scripts/check-frontend-script-manifest.js`
- `node --test frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js`

Batch 3 local verification result so far:

- ECS mode tests: passed, 4 tests.
- Mode bridge tests: passed, 4 tests.
- Boundary guard tests: passed, 9 tests.
- Mode spine guard tests: passed, 5 tests.
- ECS core guard: passed, 0 violations.
- ECS boundary guard: passed, 0 violations across 229 scanned files.
- ECS mode spine guard: passed, 0 violations across 222 scanned files; current mode findings are 1045, with 960 legacy findings matching the 0A baseline after approved owner/bridge/vocabulary paths are excluded.
- Frontend script manifest guard: passed, 219 local scripts and 1 stylesheet.
- App/Shell focused tests: passed, 89 tests.
- `npm run format:check`: passed.
- `npm run test:architecture`: passed, 1154 tests and all architecture guards.
- `git diff --check`: passed.

## Review Gate

0A, 0B, and Batch 1 are marked completed in this document because migration owner review passed.

Batch 2 is `Completed` after migration owner review.

Batch 3 is `Completed` after migration owner review.

Required owner sign-off record:

| Reviewer                | Review Time                  | Decision | Notes                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex/external-review` | `2026-06-25 14:01:38 +08:00` | Passed   | Guard data matched inventory documents; report-only behavior, architecture smoke integration, baseline format, and operating-plan status were accepted. Two minor findings remain review follow-ups: inspect unknown writes for missed source-of-truth owners, and clean bridge false positives during 0B/manual review.                                                                      |
| `codex/external-review` | `2026-06-25 16:43:55 +08:00` | Passed   | 0B renderer authority, input branch, and literal/duplicate baselines are accepted for completion. Batch 1 may start after this completion commit reaches the server branch.                                                                                                                                                                                                                   |
| `codex/external-review` | `2026-06-25 18:33:08 +08:00` | Passed   | Batch 1 ADR, blocking guard, guard tests, architecture smoke integration, no-runtime-change scope, and no-dependency-install scope are accepted. Review follow-ups for Batch 2: ADR should add why other ECS libraries were not selected, define a bitECS maintenance/exit strategy, and pin an exact `bitecs` version when installing the dependency.                                        |
| `codex/external-review` | `2026-06-25 20:16:29 +08:00` | Passed   | Batch 2 dependency pin, ECS core boundary, manifest skeleton, boundary blocking guard, no-runtime-loading scope, H5/minigame entrypoint safety, ADR follow-up updates, and progress records are accepted for completion.                                                                                                                                                                      |
| `codex/external-review` | `2026-06-25 23:02:25 +08:00` | Passed   | Batch 3 mode ownership spine accepted: the singleton ECS mode entity is approved as the first runtime ECS owner; `CanvasModeOwnershipBridge.js` is accepted as a narrow temporary bridge; the mode spine guard blocks legacy mode-decision growth while allowing owner/bridge/vocabulary paths; the generated IIFE runtime bundle is accepted until a broader frontend build pipeline exists. |
| Pending                 | -                            | Pending  | Batch 4 input intent boundary plan approved; implementation and review pending.                                                                                                                                                                                                                                                                                                               |

## Push / Deploy Evidence

| Remote / Hook                                       | Result                   | Evidence                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `d4919fde` | Server accepted `8aa553d9..d4919fde`                                                                                                                                                                                                                                     |
| Refactor test server deploy hook                    | Failed after checkout    | Hook checked out `d4919fde`, then `npm` failed with `EACCES: permission denied, rmdir '/www/wwwroot/h5-refactor-worktree/node_modules/.bin'`                                                                                                                             |
| `github codex/refactor-tutorial-guide-architecture` | Failed                   | HTTPS remote was used. Schannel reported `failed to receive handshake`; OpenSSL retry reported `unexpected eof while reading`                                                                                                                                            |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `87876c1a` | Remote branch resolved to `87876c1a6e37ace396759201c503a9aeb3f21a2f` after the push timeout; local branch is aligned with `origin`                                                                                                                                       |
| Refactor test server permission repair              | Completed                | Root-owned ignored dependency directories were removed and `/www/wwwroot/h5-refactor-worktree` plus `/opt/wxgame-refactor/.wxgame` were restored to `www:www`; `node_modules`, `node_modules/.bin`, and `backend/node_modules` now resolve as `www:www`                  |
| Refactor test server deploy                         | Completed                | `/opt/wxgame-refactor/.wxgame/current-deploy.json` records environment `refactor-test`, branch `codex/refactor-tutorial-guide-architecture`, commit `87876c1a6e37ace396759201c503a9aeb3f21a2f`, deployed at `2026-06-25T06:24:43Z`                                       |
| Refactor test server health                         | Passed                   | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok` and deployed commit `87876c1a6e37ace396759201c503a9aeb3f21a2f`                                                                                                                                   |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `8ebedeb4` | Deploy hook ran the full test-server gate: `npm run format:check`, `npm test`, `npm run test:architecture`, backend syntax check, and frontend manifest check                                                                                                            |
| Runtime backend permission repair                   | Completed                | `/opt/wxgame-refactor/backend/node_modules` was also root-owned from an earlier root install; it was removed and recreated by `www` during deploy                                                                                                                        |
| Root PM2 refactor process cleanup                   | Completed                | Root-owned `wxgame-refactor-server` and `wxgame-refactor-world-worker` were removed from root PM2 because they occupied port `3003`; `www` PM2 now owns the refactor server and worker                                                                                   |
| Refactor test server final deploy                   | Completed                | Deploy script completed successfully for `8ebedeb48d7ea3220ee35233f084a24e3a270761`; PM2 listener confirmed port `3003`, worker confirmed online, and health returned `status: ok` with deployedAt `2026-06-25T06:53:04Z`                                                |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `b3454765` | Initial push returned HTTP 504 after about five minutes, but `git ls-remote origin refs/heads/codex/refactor-tutorial-guide-architecture` resolved to `b345476557adb7fbc0aa287c606484b73ba79222`; local tracking was refreshed with `git fetch`                          |
| Refactor test server deploy hook                    | Incomplete over push     | Health stayed on deployed commit `048531425993ba7d6502cde3f2a53be6810a55cc` after the 504, while `/www/wwwroot/h5-refactor-worktree` had been refreshed to the new checkout; no successful deploy record was written by the push-side hook                               |
| Refactor test server manual deploy                  | Completed                | Ran the same refactor wrapper as `www`: `REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`; gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks         |
| Refactor test server health                         | Passed                   | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `b345476557adb7fbc0aa287c606484b73ba79222`, deployedAt `2026-06-25T07:57:40Z`, and deploymentId `5b461b9c46ce8d33`                                                              |
| `github codex/refactor-tutorial-guide-architecture` | Failed                   | HTTPS remote was used (`https://github.com/18301724526/WXGames.git`). Push failed with `schannel: failed to receive handshake, SSL/TLS connection failed`; credentials and remote URL were not changed                                                                   |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `22bf9106` | Initial push returned HTTP 504 after about five minutes, but `git ls-remote origin refs/heads/codex/refactor-tutorial-guide-architecture` resolved to `22bf910653dd2503ea98d12f9557d900c60ca12b`; local tracking was refreshed with `git fetch`                          |
| Refactor test server deploy hook                    | Incomplete over push     | Health stayed on deployed commit `1c190fa87c3d897869d20666d575f77c77f7172d` after the 504; the server branch had the new commit but no successful deploy record had been written by the push-side hook                                                                   |
| Refactor test server manual deploy                  | Completed                | Ran the same refactor wrapper as `www`: `REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`; gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks         |
| Refactor test server health                         | Passed                   | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `22bf910653dd2503ea98d12f9557d900c60ca12b`, deployedAt `2026-06-25T09:46:04Z`, and deploymentId `bea2ce6afb3fa219`                                                              |
| `github codex/refactor-tutorial-guide-architecture` | Failed                   | HTTPS remote was used (`https://github.com/18301724526/WXGames.git`). Push failed with `schannel: failed to receive handshake, SSL/TLS connection failed`; credentials and remote URL were not changed                                                                   |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `08acdf88` | Initial push returned HTTP 504 after about five minutes, but `git ls-remote origin refs/heads/codex/refactor-tutorial-guide-architecture` resolved to `08acdf8810e3220c75b46b5c9382dd8ceb2786a8`; local tracking was refreshed with `git fetch`                          |
| Refactor test server deploy hook                    | Incomplete over push     | Health stayed on deployed commit `748e9c6c3e21b3bc6327563298ed1d080557beb2` after the push-side 504; the server branch had the new commit but no successful deploy record had been written by the push-side hook                                                         |
| Refactor test server manual deploy                  | Completed                | Ran the same refactor wrapper as `www`: `REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`; gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks         |
| Refactor test server health                         | Passed                   | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `08acdf8810e3220c75b46b5c9382dd8ceb2786a8`, deployedAt `2026-06-25T11:45:26Z`, and deploymentId `e2fa9eb6fcbe78d4`                                                              |
| `github codex/refactor-tutorial-guide-architecture` | Failed                   | HTTPS remote was used (`https://github.com/18301724526/WXGames.git`), but `.git/config` routes GitHub through `http://127.0.0.1:7897`; the local proxy was not listening, so push failed with `Could not connect to server`. Credentials and remote URL were not changed |

Permission root cause:

- Earlier dependency installation ran as `root` inside the isolated refactor worktree, leaving ignored dependency directories owned by `root:root`.
- The deploy checkout uses `git clean -fd`, which does not remove ignored directories such as `node_modules`.
- The deploy gate later runs as `www`; `npm ci` attempted to remove `/www/wwwroot/h5-refactor-worktree/node_modules/.bin` and failed with `EACCES`.
- The same root install pattern also left `/opt/wxgame-refactor/backend/node_modules` owned by `root:root`, which blocked runtime `npm install --omit=dev` until that dependency directory was removed and recreated by `www`.
- A separate root PM2 process pair for the refactor server occupied port `3003`, causing the `www` PM2 restart to loop with `EADDRINUSE`; deleting only the root-owned refactor PM2 apps let the isolated `www` PM2 service own the port.
- The server-side repair removed the polluted dependency directories, restored ownership of the refactor worktree/runtime/deploy state directories to `www:www`, and kept production plus battle test PM2 apps untouched.

## Next Step

0A is officially complete on the server branch after deploy commit `8ebedeb48d7ea3220ee35233f084a24e3a270761`.

0B is officially complete after migration owner review. Batch 1 started after this completion commit reached the server branch.

Batch 1 is officially complete after migration owner review. Batch 2 is officially complete after migration owner review.

Batch 3 is `Completed` after migration owner review. Batch 4 (Input Intent Boundary) may start after this completion commit reaches the server branch.

Batch 4 planning is recorded in the operating plan as first-window deliverables. Implementation has not started; this step updates planning documents only and changes no Batch 4 code.
