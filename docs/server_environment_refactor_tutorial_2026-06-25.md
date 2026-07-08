# WXGame Refactor Tutorial Test Server Environment Report - 2026-06-25

This document records the isolated test server for `codex/refactor-tutorial-guide-architecture`.
It must not reuse the existing battle-core test server runtime.

## Scope

- Test branch: `codex/refactor-tutorial-guide-architecture`.
- Public entry: `http://47.116.32.216/wxgame-refactor/`.
- API entry: `http://47.116.32.216/wxgame-refactor-api/`.
- Frontend badge: `TUTORIAL REFACTOR`.
- Deploy manifest environment: `refactor-test`.

## Isolation Boundary

| Surface              | Existing test server                       | Refactor tutorial test server                  |
| -------------------- | ------------------------------------------ | ---------------------------------------------- |
| Frontend public dir  | `/www/wwwroot/h5-test`                     | `/www/wwwroot/h5-refactor`                     |
| Work tree            | `/www/wwwroot/h5-test-worktree`            | `/www/wwwroot/h5-refactor-worktree`            |
| Backend dir          | `/opt/wxgame-test/backend`                 | `/opt/wxgame-refactor/backend`                 |
| Shared symlink       | `/opt/wxgame-test/shared`                  | `/opt/wxgame-refactor/shared`                  |
| Deploy state         | `/opt/wxgame-test/.wxgame`                 | `/opt/wxgame-refactor/.wxgame`                 |
| SQLite DB            | `/opt/wxgame-test/backend/civilization.db` | `/opt/wxgame-refactor/backend/civilization.db` |
| API listener         | `127.0.0.1:3002`                           | `127.0.0.1:3003`                               |
| API reverse proxy    | `/wxgame-test-api/`                        | `/wxgame-refactor-api/`                        |
| Frontend route       | `/wxgame-test/`                            | `/wxgame-refactor/`                            |
| API PM2 app          | `wxgame-test-server`                       | `wxgame-refactor-server`                       |
| World worker PM2 app | `wxgame-test-world-worker`                 | `wxgame-refactor-world-worker`                 |

## Deploy Entry

The refactor tutorial deploy entry is:

```bash
bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture
```

The wrapper sets:

```bash
DEPLOY_ENVIRONMENT=refactor-test
DEPLOY_GATE_SCRIPT=scripts/test-server-ci-gate.sh
POST_BACKEND_SYNC_SCRIPT=scripts/prepare-test-server-runtime.sh
FRONTEND_API_BASE=/wxgame-refactor-api
FRONTEND_ENVIRONMENT_LABEL="TUTORIAL REFACTOR"
PORT=3003
PM2_APP_NAME=wxgame-refactor-server
WORLD_WORKER_PM2_NAME=wxgame-refactor-world-worker
DEPLOY_STATE_DIR=/opt/wxgame-refactor/.wxgame
BACKEND_DIR=/opt/wxgame-refactor/backend
WORK_TREE=/www/wwwroot/h5-refactor-worktree
FRONTEND_PUBLIC_DIR=/www/wwwroot/h5-refactor
```

## Server Hook

The server bare repo at `/home/git/wxgame.git` should route the branch independently:

- `refs/heads/main` continues to deploy production.
- `refs/heads/codex/battle-core-test-server` continues to deploy `/wxgame-test/`.
- `refs/heads/codex/refactor-tutorial-guide-architecture` deploys `/wxgame-refactor/`.

The refactor branch must not restart PM2 apps `server`, `wxgame-world-worker`,
`wxgame-test-server`, or `wxgame-test-world-worker`.

## Verification Commands

```bash
curl -fsS http://127.0.0.1:3003/api/health
curl -fsS http://47.116.32.216/wxgame-refactor/
curl -fsS http://47.116.32.216/wxgame-refactor-api/health
sudo -u www pm2 list
cat /opt/wxgame-refactor/.wxgame/current-deploy.json
```

Expected evidence:

- Health returns `status: ok`.
- The deploy manifest contains `environment: refactor-test`.
- The H5 shell title and badge contain `TUTORIAL REFACTOR`.
- `GameConfig.API_BASE` in the published refactor frontend is `/wxgame-refactor-api`.
- The PM2 list contains `wxgame-refactor-server` and `wxgame-refactor-world-worker`.
