---
name: deploy-urls
description: Deployed H5 frontend is at https://kodagame.top; standalone tool pages live under /tools/.
metadata: 
  node_type: memory
  type: reference
  originSessionId: b650a18f-c0ec-472b-8495-f8e0f2c889cf
---

The H5 game frontend is served at **https://kodagame.top** (HTTPS). Pushing to the `private` git remote auto-deploys via rsync of `frontend/` to the site root, so:

- Game (prod / `main` branch): `https://kodagame.top/` — backend API health `http://47.116.32.216:3000/api/health`.
- **Test server (`codex/battle-core-test-server` branch，分支已归档，2026-07-09 起全仓单一 main): `https://kodagame.top/wxgame-test/`** — this is the live, public URL for what the `private`/`local` test-server deploy publishes (static frontend from `/www/wwwroot/h5-test`, backend on internal port `:3002`). To confirm a test deploy is live, load this URL and check the asset version query string — it is rewritten to `?v=deploy-<commit>` (e.g. `?v=deploy-0156e763...`). Do NOT curl `47.116.32.216:3002` directly — that internal backend port returns 502 externally; it is not the public endpoint.
- Standalone tool pages (e.g. the battle stress lab): `https://kodagame.top/tools/<name>.html` — assets referenced from a tool page must use `../assets/...` (tool is one level deep under the site root).
- Refactor 测试环境（现行主验证目标）：https://kodagame.top/wxgame-refactor/，后端内部端口 3003，玩家 API 路径 /wxgame-refactor-api；:3002 属另一环境勿用于 refactor 验证。

Note: relative `../assets/` paths only resolve when the page is opened via the domain, not via a local file/preview. See [[github-push-https]] for the push/deploy mechanics.
