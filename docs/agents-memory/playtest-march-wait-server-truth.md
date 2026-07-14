---
name: playtest-march-wait-server-truth
description: "March-wait false stall root cause — client worldExplorerState mirror freezes between syncs (reconciler local-wins merge); harness must judge march progress/arrival from the raw syncOnce() payload, never the mirror."
metadata: 
  node_type: memory
  type: project
  originSessionId: 115c2554-afd2-4b6d-8e0a-1a80f3318915
---

2026-07-04, fixed on `codex/design-march-eta` and verified against the local WSL environment.

**Root cause of "march-stalled-no-progress" 误报:** the harness compared `game.state.worldExplorerState` mission JSON between syncs, but that mirror is intentionally frozen: `MarchReconciler.mergeAuthorityIntoLocal` spreads `{...authority, ...local}` (local wins), so the stored mission keeps its first-reconcile snapshot of position/reveal/status — march visuals are re-projected per frame from `(mission, nowMs)`, not stored. Any march leg > 60s stall window → guaranteed false stall. Same merge can hold `status:'active'` after the server went idle (mirror never converges on the `syncOnce`→`applyState` path).

**Why live play still converges:** the heartbeat path (`applyApiState` → stateNormalizer → `syncFromServer`) BYPASSES the optimistic reconciler. Two apply paths produce different mirrors; the reconciler defect is masked in live play, exposed under harness (page idle → no heartbeat). **Reconciler fixed 2026-07-04 on `codex/design-march-eta` (`425418e5`, 后已双推部署并随 2026-07-09 main 统一并入 main，分支名已亡):** `mergeAuthorityIntoLocal` no longer spreads local over authority — authority wins all server-owned fields, local only backfills DTO-omitted fields + `_optimistic` bookkeeping; test pins stale-active mirror → authority idle → `activeMission:null` in one pass. The harness raw-payload rule below still stands (defense in depth + pre-fix builds).

**How to apply:** any harness/tool that waits on march (or similar server-timed) progress must read the RAW `/game/state` payload returned by `window.Game.syncOnce()` (`payload.gameState.worldExplorerState`, pre-reconcile; `getMissionDto` runs `deriveMissionForTime` per fetch so active-mission JSON changes every round and the active set empties at completion). Do not swallow sync errors (`march-sync-failed` fail-fast); once the raw server payload reports arrival, stop waiting even if a stale client mirror still appears active. Supersedes the "syncOnce 坑" fragment in [[overnight-ssot-server-perf]].
