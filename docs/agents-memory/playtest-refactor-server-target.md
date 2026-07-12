---
name: playtest-refactor-server-target
description: "Tutorial playtest MUST hit the branch's own deploy (/wxgame-refactor/); the 2026-07-03 \"tutorial deadlock\" was the harness playing PROD (old numeric steps mislabelled +4 by the new step table) — that failure signature means WRONG SERVER, not a flow bug."
metadata: 
  node_type: memory
  type: project
  originSessionId: 615c3944-6983-4fe9-b609-d45208eb3754
---

`scripts/playtest-online-tutorial.js` on `codex/refactor-tutorial-guide-architecture` originally defaulted to the MAIN server (`http://47.116.32.216/wxgame/` + `:3000/api`), which runs `main`'s legacy NUMERIC step table. The 2026-07-03T22-06 run therefore "found" a tutorial deadlock that does not exist on the branch: in-page `TutorialFlowShared` was absent (old build), the harness fell back to `Number(raw)`, and every logged step name was shifted **+4** against the new `shared/tutorialFlowConfig.js` STEP_ORDER (which inserts 4 barracks/first-army steps after `era3Advanced`). Prod's world worker also wasn't ticking the march (0 route progress in 90s), so the run stalled at old-25 = `firstCityDiscovered` while labelled `formationPanelOpened`.

**Why:** step labels in evidence come from the HARNESS's step table, not the server's; against a foreign build every label is a lie and produces convincing-but-fictional bug reports.

**How to apply:** fixed in `dfe60609` — defaults now point at `http://47.116.32.216/wxgame-refactor/` + `/wxgame-refactor-api` (docs/server_environment_refactor_tutorial_2026-06-25.md), the harness throws if the page lacks `window.TutorialFlowShared`, and march-arrival waits are site-scoped + capped at 20. If a playtest ever shows "step names don't match the actions performed" or "no barracks chain ran", suspect the target server's build FIRST. Deploy health (incl. deploy-gate failure logs) is at `/wxgame-refactor-api/health` → `appVersion.deployStatus.recentLogLines`. Related: [[deploy-lint-gate]], [[local-dev-env]].
