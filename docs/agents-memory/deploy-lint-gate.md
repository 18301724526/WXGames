---
name: deploy-lint-gate
description: "Test-server pre-deploy gate (prod, not WSL) runs lint + format:check + tests; any failure aborts the deploy silently."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4ae85704-c819-4e6d-8e7d-364f5bcba311
---

The **prod** test-server gate (`scripts/test-server-ci-gate.sh`, run by the `private` remote's deploy; the `local`/WSL gate is lighter and does NOT run these) runs, in order: `npm run lint` → **`npm run format:check`** (prettier --check . over the WHOLE repo, incl. docs/*.md) → `npm run lint:baseline:ci` + `lint:baseline:check` (suppressions budget vs `main`) → `npm test` → `npm run test:architecture` → `npm run check --prefix backend`. **Any** failure aborts deploy.sh before the PM2 restart, so the ref updates but the server keeps serving the OLD commit (the git push still exits 0 — it does not surface the gate failure).

Two ways this has bitten: (1) removing code that had a suppressed violation leaves a stale suppression → `npm run lint` exits 2; (2) committing a file that isn't prettier-clean (e.g. a hand-written dev-log markdown table) → `npm run format:check` fails.

**Why it slips through:** (a) local `npm test` / `npm run test:architecture` do NOT run eslint or prettier, so a green local run can still abort the gate. (b) **`npm test` (full, ~1682 tests, every `*.test.js` via `scripts/run-node-tests.js`) is a SUPERSET of `npm run test:architecture` (~1254, a curated subset).** Passing `test:architecture` does NOT imply `npm test` passes — a test file outside the architecture set (e.g. `frontend/js/platform/interactions/TechTreeInteractionModel.test.js`) can be red while `test:architecture` is green. This bit hard on 2026-06-26: a slice-5d regression (commit `fecff561`, `handle_openTaskCenter` dropped game-host `showTaskCenter` propagation) failed one `npm test`-only test and silently blocked EVERY refactor-branch deploy for ~6 hours (through batches 8A/8B/8C); each push returned exit 0 while the server kept serving the old commit.

**How to apply:** before pushing to `private`, run the gate's checks locally — at minimum `npm run lint` AND `npm run format:check` (run `npx prettier --write` on anything it flags) AND the **full `npm test`** (not just `test:architecture`). For stale suppressions run `npx eslint . --prune-suppressions --suppressions-location eslint-suppressions.json` then re-add the trailing newline. Verify a test deploy is live at **`https://kodagame.top/wxgame-test/`** (asset version becomes `?v=deploy-<commit>`) — see [deploy-urls](deploy-urls.md); `kodagame.top/` itself serves the separate `main` branch. The deploy log's own health check (`部署完成` + `status:ok`) is also authoritative. See [local-dev-env](local-dev-env.md).
