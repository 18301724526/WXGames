# WXGame Test Server Environment Report - 2026-06-22

This document is branch-owned by `codex/battle-core-test-server`. It records the isolated test server created for validating the battle-loop integration without occupying the main server runtime.

## Scope

- Test branch: `codex/battle-core-test-server`.
- Source baseline: `main` commit `310eb0b73d9012b43b14cbf94402d78dc5608344`.
- Public entry: `http://47.116.32.216/wxgame-test/`.
- API entry: `http://47.116.32.216/wxgame-test-api/`.
- Frontend badge: `TEST SERVER` is injected into the published H5 shell.
- Deploy manifest environment: `test`.

## Isolation Boundary

The test server must not reuse production runtime paths, PM2 names, ports, deploy state, or public URL prefixes.

| Surface              | Main server                                     | Test server                                |
| -------------------- | ----------------------------------------------- | ------------------------------------------ |
| Frontend public dir  | `/www/wwwroot/h5`                               | `/www/wwwroot/h5-test`                     |
| Work tree            | `/www/wwwroot/h5`                               | `/www/wwwroot/h5-test-worktree`            |
| Backend dir          | `/opt/wxgame-workspace/backend`                 | `/opt/wxgame-test/backend`                 |
| Shared symlink       | `/opt/wxgame-workspace/shared`                  | `/opt/wxgame-test/shared`                  |
| Deploy state         | `/opt/wxgame-workspace/.wxgame`                 | `/opt/wxgame-test/.wxgame`                 |
| SQLite DB            | `/opt/wxgame-workspace/backend/civilization.db` | `/opt/wxgame-test/backend/civilization.db` |
| API listener         | `127.0.0.1:3000`                                | `127.0.0.1:3002`                           |
| API reverse proxy    | `/api/`                                         | `/wxgame-test-api/`                        |
| Frontend route       | `/` or `/wxgame/` depending on Nginx entry      | `/wxgame-test/`                            |
| API PM2 app          | `server`                                        | `wxgame-test-server`                       |
| World worker PM2 app | `wxgame-world-worker`                           | `wxgame-test-world-worker`                 |

## Data Copy Rule

Test data is copied one-way from the main server database to the test database before a test deploy:

```bash
MAIN_DB_PATH=/opt/wxgame-workspace/backend/civilization.db
DB_PATH=/opt/wxgame-test/backend/civilization.db
```

The copy uses SQLite online backup through `better-sqlite3` and removes any previous test WAL/SHM files before replacing the test DB. The test server never writes back to the main DB.

## Deploy and Gate

The test server deploy entry is:

```bash
bash scripts/deploy-test-server.sh codex/battle-core-test-server
```

The deploy wrapper sets the isolated runtime variables and calls:

```bash
bash deploy.sh codex/battle-core-test-server
```

with:

```bash
DEPLOY_ENVIRONMENT=test
DEPLOY_GATE_SCRIPT=scripts/test-server-ci-gate.sh
POST_BACKEND_SYNC_SCRIPT=scripts/prepare-test-server-runtime.sh
FRONTEND_API_BASE=/wxgame-test-api
FRONTEND_ENVIRONMENT_LABEL="TEST SERVER"
PORT=3002
PM2_APP_NAME=wxgame-test-server
WORLD_WORKER_PM2_NAME=wxgame-test-world-worker
DEPLOY_STATE_DIR=/opt/wxgame-test/.wxgame
BACKEND_DIR=/opt/wxgame-test/backend
WORK_TREE=/www/wwwroot/h5-test-worktree
FRONTEND_PUBLIC_DIR=/www/wwwroot/h5-test
```

After backend files are synced into `/opt/wxgame-test/backend`, `scripts/prepare-test-server-runtime.sh` copies the main database snapshot into the test DB and syncs the main backend `.env` into the isolated backend directory. This ordering prevents backend `rsync --delete` from removing the copied test runtime files.

The test deploy gate is intentionally CI-equivalent and installs dev dependencies explicitly. The gate process forces `NODE_ENV=test`, sets `CONFIG_RELEASE_GATE=warn`, and clears runtime-only version/deploy-state variables; the runtime process still starts with `NODE_ENV=production`.

```bash
npm run lint
npm run format:check
npm run lint:baseline:ci
npm run lint:baseline:check -- --base tmp/eslint-suppressions.base.json
npm test
npm run test:architecture
npm run check --prefix backend
```

GitHub Actions also runs `scripts/test-server-ci-gate.sh` for pushes and pull requests targeting `codex/battle-core-test-server`.

## Server Hook

The server bare repo at `/home/git/wxgame.git` should keep the existing `main` deploy behavior and add only a branch-specific test deploy branch:

- `refs/heads/main` continues to call the production deploy path.
- `refs/heads/codex/battle-core-test-server` checks out to `/www/wwwroot/h5-test-worktree` and calls `scripts/deploy-test-server.sh codex/battle-core-test-server`.

The hook must not restart PM2 apps `server` or `wxgame-world-worker` for the test branch.

## Verification Commands

```bash
curl -fsS http://127.0.0.1:3002/api/health
curl -fsS http://47.116.32.216/wxgame-test/
curl -fsS http://47.116.32.216/wxgame-test-api/health
sudo -u www pm2 list
cat /opt/wxgame-test/.wxgame/current-deploy.json
```

Expected evidence:

- Health returns `status: ok`.
- The deploy manifest contains `environment: test`.
- The H5 shell title and badge contain `TEST SERVER`.
- `GameConfig.API_BASE` in the published test frontend is `/wxgame-test-api`.
- The PM2 list contains `wxgame-test-server` and `wxgame-test-world-worker`; production PM2 names remain separate.
