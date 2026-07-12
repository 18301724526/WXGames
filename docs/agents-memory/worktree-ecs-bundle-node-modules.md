---
name: worktree-ecs-bundle-node-modules
description: "Never rebuild EcsModeRuntimeBundle in a worktree without its OWN root node_modules — esbuild burns '../../../node_modules/...' paths into the artifact and the server's bundle-freshness gate fails the deploy."
metadata: 
  node_type: memory
  type: project
  originSessionId: 615c3944-6983-4fe9-b609-d45208eb3754
---

In a `.claude/worktrees/*` checkout, node resolution walks UP to the main repo's `node_modules`, so lint/tests work — but `npm run build:ecs-runtime` (esbuild) then records module keys/comments as `../../../node_modules/bitecs/...` instead of `node_modules/bitecs/...`. The committed bundle stops being reproducible on the server (Linux fresh build differs) and `check-frontend-ecs-runtime-bundle-fresh` fails the refactor-test deploy gate with a tail of `pass N-1 / fail 1` in `appVersion.deployStatus.recentLogLines`.

**Why:** the bundle-freshness guard compares the committed artifact against a fresh build; any environment-dependent path leaks into the diff.

**How to apply:** before ANY `npm run build:ecs-runtime` in a worktree, run `npm ci --include=dev --ignore-scripts` at the worktree root (and `npm ci --prefix backend` for tests). If the local freshness test "fails" right after cloning/worktree-creation, it's this — install deps and rebuild rather than committing the drifted bundle. Also note `frontend/js/tutorial/*` files are NOT bundle inputs; a registry edit alone never requires a bundle rebuild. Related: [[line-endings-lf]], [[deploy-lint-gate]].

**2026-07-13 扩充(V1 环境事故)**:worktree 跑后端必须联结**两处**:根 `node_modules` **和** `backend/node_modules`(后端依赖住 backend/,不住根;根里若有后端包是历史顺风车,npm ci 会清掉它)。建联结用 PowerShell `New-Item -ItemType Junction`(git-bash 里 cmd mklink 的引号转义会把目标搞成无效 `\F:\...`);**删联结用 `cmd /c rmdir`,严禁 `rm -rf`**(可能穿透联结删真身)。worktree 题面必须加一条:**禁止 npm install/ci**(穿过联结改主仓 node_modules)。
