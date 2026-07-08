# WXGame Main Server Environment Report - 2026-06-22

This document is owned by `main`. It records the production server and the separated test server that was created from branch `codex/battle-core-test-server`.

## Main Server

- Host: `47.116.32.216`.
- Production branch: `main`.
- Current deployed commit: `310eb0b73d9012b43b14cbf94402d78dc5608344`.
- Current deployed commit time: `2026-06-22 04:27:38 +0800`.
- Frontend public dir and work tree: `/www/wwwroot/h5`.
- Backend dir: `/opt/wxgame-workspace/backend`.
- SQLite DB: `/opt/wxgame-workspace/backend/civilization.db`.
- Deploy state: `/opt/wxgame-workspace/.wxgame/current-deploy.json`.
- API listener: `127.0.0.1:3000`.
- Public API route: `/api/`.
- Public H5 route: `/wxgame/` and the root site route.
- PM2 apps under user `www`: `server`, `wxgame-world-worker`.
- Git HTTP bare repo: `/home/git/wxgame.git`, served on port `3001`.

## Test Server

The test server is deliberately not merged into `main`. Its deployment code and test-server report live on branch `codex/battle-core-test-server`.

- Public H5 route: `http://47.116.32.216/wxgame-test/`.
- Public API route: `http://47.116.32.216/wxgame-test-api/`.
- Frontend public dir: `/www/wwwroot/h5-test`.
- Test work tree: `/www/wwwroot/h5-test-worktree`.
- Backend dir: `/opt/wxgame-test/backend`.
- SQLite DB: `/opt/wxgame-test/backend/civilization.db`.
- Deploy state: `/opt/wxgame-test/.wxgame/current-deploy.json`.
- API listener: `127.0.0.1:3002`.
- PM2 apps under user `www`: `wxgame-test-server`, `wxgame-test-world-worker`.
- Visible frontend marker: `TEST SERVER`.
- Nginx response marker: `X-WXGame-Environment: test`.

## Isolation Contract

The production server and test server must stay separated by path, port, PM2 name, deploy state, URL prefix, and database file.

| Surface              | Main server                                     | Test server                                |
| -------------------- | ----------------------------------------------- | ------------------------------------------ |
| Branch               | `main`                                          | `codex/battle-core-test-server`            |
| Frontend public dir  | `/www/wwwroot/h5`                               | `/www/wwwroot/h5-test`                     |
| Work tree            | `/www/wwwroot/h5`                               | `/www/wwwroot/h5-test-worktree`            |
| Backend dir          | `/opt/wxgame-workspace/backend`                 | `/opt/wxgame-test/backend`                 |
| Shared symlink       | `/opt/wxgame-workspace/shared`                  | `/opt/wxgame-test/shared`                  |
| Deploy state         | `/opt/wxgame-workspace/.wxgame`                 | `/opt/wxgame-test/.wxgame`                 |
| SQLite DB            | `/opt/wxgame-workspace/backend/civilization.db` | `/opt/wxgame-test/backend/civilization.db` |
| API listener         | `127.0.0.1:3000`                                | `127.0.0.1:3002`                           |
| API reverse proxy    | `/api/`                                         | `/wxgame-test-api/`                        |
| API PM2 app          | `server`                                        | `wxgame-test-server`                       |
| World worker PM2 app | `wxgame-world-worker`                           | `wxgame-test-world-worker`                 |

## Data Rule

Test data is copied one-way from `/opt/wxgame-workspace/backend/civilization.db` to `/opt/wxgame-test/backend/civilization.db` during a test-server deploy. The test server never writes back to the main database.

## Verification

Production health:

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

Test health:

```bash
curl -fsS http://127.0.0.1:3002/api/health
curl -fsS http://47.116.32.216/wxgame-test-api/health
curl -fsSI http://47.116.32.216/wxgame-test/
```

Expected state after the 2026-06-22 setup:

- Main health reports `version: 0.2.1`, `branch: main`, and deployed commit `310eb0b73d9012b43b14cbf94402d78dc5608344`.
- Test health reports `version: 0.2.1-test`, `branch: codex/battle-core-test-server`, and deployed commit `25e7a401e9928047ce739517116005380d7c1bc0`.
- PM2 under user `www` contains both main apps and test apps, with separate cwd/script paths.
