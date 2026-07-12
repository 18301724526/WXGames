---
name: tutorial-guide-refresh-contract
description: Guide registry only re-runs on refreshCurrentHighlight — every action that changes modal/picker state MUST notify it; march-poll renders mask omissions in live sessions but restored sessions expose them.
metadata: 
  node_type: memory
  type: project
  originSessionId: 83a96dcf-8f7c-4b66-a9e4-40059afe5017
---

The tutorial guide's flow registry (follow-through rules, e.g. into the world
target picker) re-runs ONLY when `tutorialController.refreshCurrentHighlight()`
is called. There is no central hook: each action handler that mutates
modal/picker/HUD state must call it (march cluster does via
`WorldMarchActionHandler.refreshTutorialHighlightAfterAction(core)` — a shared
static since `1483d151`; borrowed by TargetPickerActionHandler).

**Why:** the per-frame highlight rebuild (`TutorialGuideUiController.refreshTarget`)
only re-anchors the existing highlight, never re-runs the registry. In a live
session an omission is MASKED because `CanvasGameApp.renderCanvasSurface`
(march-poll / sync renders) calls refreshCurrentHighlight incidentally; a
reloaded session has no such loop, so a missed notification = stale highlight =
input shield deadlock (hit `{type:'blockCanvasModal', allowedAction:null}`).
This was the firstCityDiscovered reload stall (fixed `1483d151` on
codex/refactor-tutorial-guide-architecture, cherry-picked `40439feb` onto
codex/design-march-eta for the WSL deploy).

**How to apply:** when adding/extracting an action that opens or closes any
canvas modal, call `refreshTutorialHighlightAfterAction` after the layer
refresh — and treat "works live but not after reload" as the signature of a
missing guide notification. Verified via the two-phase WSL playtest:
`PLAYTEST_MAX_ACTIONS=56` fresh run parks codexqa at firstCityDiscovered, then
`PLAYTEST_RESET_ACCOUNT=0` rerun exercises the restored-session path. Related:
[[tutorial-chain-rework-progress]], [[playtest-refactor-server-target]].
