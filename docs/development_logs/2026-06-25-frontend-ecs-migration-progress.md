# Frontend ECS Migration Progress - 2026-06-25

## Current Status

| Field                  | Value                                        |
| ---------------------- | -------------------------------------------- |
| Branch                 | `codex/refactor-tutorial-guide-architecture` |
| Current batch          | `0A. Mode and Bridge Inventory`              |
| Batch state            | `Completed`                                  |
| Runtime code migration | Not started                                  |
| ECS dependency         | Not introduced                               |
| Last updated           | `2026-06-25 14:53:09 +08:00`                 |

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

| Guard                | Files Scanned |             Findings / Candidates | Blocking?       | Command                                                        |
| -------------------- | ------------: | --------------------------------: | --------------- | -------------------------------------------------------------- |
| Mode ownership guard |           213 |          960 findings, 25 symbols | No, report-only | `node scripts/report-frontend-ecs-mode-ownership.js --summary` |
| Bridge shrink guard  |           213 | 39 candidates, 1911 branch tokens | No, report-only | `node scripts/report-frontend-ecs-bridge-shrink.js --summary`  |

## Verification Commands

Executed before this progress entry:

- `node --test scripts/report-frontend-ecs-mode-ownership.test.js`
- `node --test scripts/report-frontend-ecs-bridge-shrink.test.js`
- `node scripts/report-frontend-ecs-mode-ownership.js --summary`
- `node scripts/report-frontend-ecs-bridge-shrink.js --summary`

Executed before commit/push:

- `npm run test:architecture`
- `git diff --check`
- `git status --short`

## Review Gate

0A is marked completed in this document because migration owner review passed.

Required owner sign-off record:

| Reviewer                | Review Time                  | Decision | Notes                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `codex/external-review` | `2026-06-25 14:01:38 +08:00` | Passed   | Guard data matched inventory documents; report-only behavior, architecture smoke integration, baseline format, and operating-plan status were accepted. Two minor findings remain review follow-ups: inspect unknown writes for missed source-of-truth owners, and clean bridge false positives during 0B/manual review. |

## Push / Deploy Evidence

| Remote / Hook                                       | Result                   | Evidence                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `d4919fde` | Server accepted `8aa553d9..d4919fde`                                                                                                                                                                                                                    |
| Refactor test server deploy hook                    | Failed after checkout    | Hook checked out `d4919fde`, then `npm` failed with `EACCES: permission denied, rmdir '/www/wwwroot/h5-refactor-worktree/node_modules/.bin'`                                                                                                            |
| `github codex/refactor-tutorial-guide-architecture` | Failed                   | HTTPS remote was used. Schannel reported `failed to receive handshake`; OpenSSL retry reported `unexpected eof while reading`                                                                                                                           |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `87876c1a` | Remote branch resolved to `87876c1a6e37ace396759201c503a9aeb3f21a2f` after the push timeout; local branch is aligned with `origin`                                                                                                                      |
| Refactor test server permission repair              | Completed                | Root-owned ignored dependency directories were removed and `/www/wwwroot/h5-refactor-worktree` plus `/opt/wxgame-refactor/.wxgame` were restored to `www:www`; `node_modules`, `node_modules/.bin`, and `backend/node_modules` now resolve as `www:www` |
| Refactor test server deploy                         | Completed                | `/opt/wxgame-refactor/.wxgame/current-deploy.json` records environment `refactor-test`, branch `codex/refactor-tutorial-guide-architecture`, commit `87876c1a6e37ace396759201c503a9aeb3f21a2f`, deployed at `2026-06-25T06:24:43Z`                      |
| Refactor test server health                         | Passed                   | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok` and deployed commit `87876c1a6e37ace396759201c503a9aeb3f21a2f`                                                                                                                  |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `8ebedeb4` | Deploy hook ran the full test-server gate: `npm run format:check`, `npm test`, `npm run test:architecture`, backend syntax check, and frontend manifest check                                                                                           |
| Runtime backend permission repair                   | Completed                | `/opt/wxgame-refactor/backend/node_modules` was also root-owned from an earlier root install; it was removed and recreated by `www` during deploy                                                                                                       |
| Root PM2 refactor process cleanup                   | Completed                | Root-owned `wxgame-refactor-server` and `wxgame-refactor-world-worker` were removed from root PM2 because they occupied port `3003`; `www` PM2 now owns the refactor server and worker                                                                  |
| Refactor test server final deploy                   | Completed                | Deploy script completed successfully for `8ebedeb48d7ea3220ee35233f084a24e3a270761`; PM2 listener confirmed port `3003`, worker confirmed online, and health returned `status: ok` with deployedAt `2026-06-25T06:53:04Z`                               |

Permission root cause:

- Earlier dependency installation ran as `root` inside the isolated refactor worktree, leaving ignored dependency directories owned by `root:root`.
- The deploy checkout uses `git clean -fd`, which does not remove ignored directories such as `node_modules`.
- The deploy gate later runs as `www`; `npm ci` attempted to remove `/www/wwwroot/h5-refactor-worktree/node_modules/.bin` and failed with `EACCES`.
- The same root install pattern also left `/opt/wxgame-refactor/backend/node_modules` owned by `root:root`, which blocked runtime `npm install --omit=dev` until that dependency directory was removed and recreated by `www`.
- A separate root PM2 process pair for the refactor server occupied port `3003`, causing the `www` PM2 restart to loop with `EADDRINUSE`; deleting only the root-owned refactor PM2 apps let the isolated `www` PM2 service own the port.
- The server-side repair removed the polluted dependency directories, restored ownership of the refactor worktree/runtime/deploy state directories to `www:www`, and kept production plus battle test PM2 apps untouched.

## Next Step

0A is officially complete on the server branch after deploy commit `8ebedeb48d7ea3220ee35233f084a24e3a270761`.

Next migration work may start `0B. Authority, Input, Literal, Duplicate Inventory`.
