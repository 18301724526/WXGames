# Frontend ECS Batch 8F (Blocking Panel Mirror Removal) - EXECUTION PLAN

> Status: **PLANNED, not started.** 8A-8E are sealed + deployed (`Ready for
Migration Owner Review`). 8F is the FINAL slice. It was fully mapped + designed;
> the migration owner chose to execute it as a dedicated focused effort. This doc
> is the self-contained plan so a fresh session can execute without re-mapping.
> Branch tip when planned: `8252085d` (8E). Last updated: `2026-06-27`.

## Decisions (locked by the migration owner)

1. **Owner model: FULL per-panel modal subtypes, into the ECS mode mask.** Each of
   the 12 blocking-panel fields becomes its own owned modal subtype. (Ruled out:
   a single-panelKey owner — proven insufficient because `activeCommandPanel==='tech'`
   and `techDetailOpen===true` provably coexist. Also considered and rejected by the
   owner: a flat panel-map payload, and per-panel-state-with-aggregate-capture.)
2. This is the deepest slice — it is the ONLY one that touches the ECS mode-resolver
   core (mask + CAPTURE_PRIORITY + blocking-overlay derivation) and regenerates the
   runtime bundle.

## The 12 panel keys -> subtypes

`BLOCKING_PANEL_KINDS` (CanvasModeOwnershipBridge.js ~294-307): showSettings, showLogs,
showResourceDetails, showCitySwitcher, showSubcityList, showCityManagement, showAdvisor,
showTaskCenter, showGuidebook, showFamousPersons (10 booleans), `activeCommandPanel`
(STRING enum: capital/military/tech/civilization/events/buildings), `techDetailOpen`
(boolean). Proposed subtypes: `modal:settings`, `modal:logs`, `modal:resourceDetails`,
`modal:citySwitcher`, `modal:subcityList`, `modal:cityManagement`, `modal:advisor`,
`modal:taskCenter`, `modal:guidebook`, `modal:famousPersons`, `modal:commandPanel`
(payload carries the string value), `modal:techDetail`. Remove `modal:blockingPanel`.

## The three axes (the semantic model — proven by the map)

- **Axis 1 (mutually exclusive overlay set):** the 10 show-stars + `activeCommandPanel`
  when non-`'tech'`. Every open does `openBlockingPanelOwner(key); closePanels([key])`,
  and `CanvasActionController.closePanels` clears all CLOSEABLE_PANELS except the kept
  one. At most one open. No flow sets two show-stars true at once.
- **Axis 2 (`activeCommandPanel` string):** carries capital/military/tech/... ; the
  value `'tech'` is NOT a blocking overlay (it is tech-tree base access). The string
  value must survive (it is not a plain boolean).
- **Axis 3 (`techDetailOpen`, INDEPENDENT):** `handle_selectTechNode`
  (CanvasCityActionHandlers.js ~360) sets it WITHOUT `closePanels`, so it overlays
  `activeCommandPanel==='tech'`. Proven simultaneity. `hasBlockingOverlayExceptTechTree`
  already ORs `(activeCommandPanel && activeCommandPanel!=='tech')` and `techDetailOpen`
  as separate terms.

## Stage 1 — ECS core (additive first, then remove blockingPanel; regenerate bundle)

Edit SOURCE then run `npm run build:ecs-runtime` (EcsModeRuntimeBundle.js is GENERATED
by scripts/build-frontend-ecs-runtime.js — never hand-edit it).

- **ModeKeys.js:** add the 11 panel subtypes to `MODAL_MODE_KEYS` (they get mask bits
  via `MODAL_BIT_BY_KEY = 1<<index`) and insert them into `CAPTURE_PRIORITY` (place the
  panels below the dialog modals but above the base modes; decide tech-detail vs
  command-panel ordering). Remove `modal:blockingPanel`.
- **ModeResolver.js:** `BLOCKING_MODAL_KEYS` (~11-18): add the 10 show-star subtypes +
  `modal:techDetail`; do NOT add `modal:commandPanel` (its blocking-ness depends on the
  string value). Remove `modal:blockingPanel`. The `commandPanel` non-`'tech'` blocking
  term stays in `facts.blockingOverlayActive` (the bridge computes it from the payload
  value, ORed into `createModeSnapshot` line ~49-52). Verify `deriveTopCaptureModeKey`
  and `canRouteTechTree` still behave (tech detail must not block tech-tree routing the
  way `activeCommandPanel==='tech'` does not).
- **RendererSnapshotBoundary.js:** `MODAL_SUBTYPES` add the 11, remove blockingPanel.
  Keep `PANEL_KEYS`/`PANEL_DEFAULTS` (the flat-12 `panel` block stays — it is now
  DERIVED from the per-panel modal entries, not from the mirror).
- **EcsBoundaryManifest.js:** update the modal subtype list; update its test.
- **Tests:** EcsBoundaryManifest.test.js, ModeKeys/ModeResolver/ModeWorld tests, and
  any test asserting the modal subtype set / CAPTURE_PRIORITY / BLOCKING_MODAL_KEYS.

## Stage 2 — Snapshot adapter (CanvasModalSnapshotAdapter.js)

Add (mirroring the 8E targetPicker helpers): a `BLOCKING_PANEL_SUBTYPE_BY_KEY` map
(panelKey -> 'modal:settings' etc.), `openBlockingPanelSnapshot(host, panelKey, value)`
(for `activeCommandPanel` the payload carries the string; for booleans open/close),
`closeBlockingPanelSnapshot(host, panelKey)`, `closeBlockingPanelsSnapshot(host, except)`
(close all panel subtypes except the keep-set — this is where the Axis-1 mutual
exclusion is enforced), `isBlockingPanelSnapshotOpen(host, panelKey, snapshot)`,
`getCommandPanelValue(host, snapshot)` (read the `modal:commandPanel` payload string),
and `buildBlockingPanelFacts(host|snapshot)` returning the flat-12 panel facts. Install
on the prototype.

## Stage 3 — Invert buildRendererPanelFacts (the single source-flip chokepoint)

CanvasModeOwnershipBridge.js `buildRendererPanelFacts` (~390-408): instead of reading
the show-star MIRROR off shell/game/host, DERIVE the 12 facts from the per-panel modal
entries (`isModalOpen('modal:settings')` -> showSettings, the `modal:commandPanel`
payload string -> activeCommandPanel, `isModalOpen('modal:techDetail')` -> techDetailOpen).
This one change flips the source so the ~40 downstream renderer/runtime reads keep
reading `snapshot.panel.showX` unchanged.

Also in the bridge: `collectModalKeys` (~91-121) pushes each open panel subtype;
`hasBlockingOverlayExceptTechTree` (~123-152) derives from the panel subtypes (the
show-stars and techDetail are blocking; commandPanel is blocking only when non-tech).
Then remove the 3 wrappers (`openBlockingPanelOwner` / `closeBlockingPanelOwner` /
`closeBlockingPanelsOwner`, ~347-388) and the helpers `syncBlockingPanelMirror`,
`writeBlockingPanelMirror`, `clearBlockingPanelMirror`, `collectBlockingPanelMirrorTargets`,
`normalizeBlockingPanelValue`, `isBlockingPanelOpenValue` (~311-345).

## Stage 4 — ~450-site migration (delegate the bulk; ~26 files)

- **Open handlers** (CanvasShellActionHandlers handle_openResourceDetails/CitySwitcher/
  SubcityList/Settings/Logs/Advisor/Guidebook/CommandPanel; CanvasCityActionHandlers
  handle_openCityManagement/openTaskCenter via openBlockingPanelEverywhere/closePanelsEverywhere;
  CanvasFamousActionHandlers handle_openFamousPersons): `openBlockingPanelSnapshot(panelKey, true|value)`.
- **closePanels / closePanelsOn / closePanelsEverywhere** (CanvasActionController.js ~179-204):
  become owner-driven (`closeBlockingPanelsSnapshot(except)`); the local
  `openBlockingPanelEverywhere` helper too.
- **Reset paths** (commands, rendering-runtime resets, system UI): `this.showX = false`
  -> `closeBlockingPanelSnapshot(panelKey)` or `closeBlockingPanelsSnapshot`.
- **Reads** (renderers, render runtimes, input routers hasBlockingOverlayOpen/ExceptTechTree
  — the DUPLICATED copies in CanvasGameAppInputRouter ~67-85 + CanvasGameShellInputRouter
  ~125-159/207-240, the command-dock highlight): read `getRendererSnapshot()?.panel?.showX`
  / `isBlockingPanelSnapshotOpen` (parallels isRewardRevealSnapshotOpen already used there).
- **Tutorial coordinator** (TutorialGuideUiStateCoordinator.js ~167-242, currently
  GRANDFATHERED): the hand-rolled opens/clears + `setIfChanged(host,'showX',false)` +
  patch-object `{ showX:false, activeCommandPanel:'' }` -> route through the adapter.
  ensureBuildingGuideVisible (~183-190) is a NON-MUTEX shape (opens activeCommandPanel
  while leaving others) -> `openBlockingPanelSnapshot('activeCommandPanel','buildings')`.
- **Tutorial event registry** (TutorialGuideEventRegistry ~4 close writes), **TutorialGuideController**.
- **RE-ASSERT-OPEN sites** (CanvasGameAppCommands.js seekFamousPerson/acceptFamousPerson/
  dismissFamousPersonCandidate/assignFamousAttributePoint ~57/77/97/115 + the 2-way mirror
  rewrites; ~747/758 showCityManagement): re-assert the already-open panel ->
  idempotent `openBlockingPanelSnapshot('showFamousPersons')` (no-op if already open).
- **Constructor mirrors** (CanvasGameApp.js + CanvasGameShell.js): remove the show-star
  field initializers.

## Scope boundaries (do NOT migrate these)

- **Panel-CONTENT cursors stay in domain state** (like EventController.activeEventId in
  8D): `selectedTechId`, `selectedFamousPersonId`, `famousPersonsPage`,
  `activeCityManagementTab`, `activeTaskCenterTab`, `activeGuidebookTab`. Only the
  visibility booleans + the `activeCommandPanel` string move to the owner.
- **`techUiState.detailOpen` stays as domain** (the tech UI's own truth that the renderer
  ORs at HudOverlayCanvasRenderer ~206 / CanvasFrameRenderer ~228). 8F retires only the
  host `techDetailOpen` mirror, not `techUiState.detailOpen`.

## Stage 5 — Guard

New `scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js` (+test) modeled on
`check-frontend-ecs-event-mirror-retirement.js`: forbid `<host>.showX = ...`,
`<host>.activeCommandPanel = ...`, `<host>.techDetailOpen = ...` writes/reads off
MIRROR_HOSTS, the `setIfChanged(host,'showX',...)` + patch-key `{ showX: ... }` idioms
(extended detection like 8D), and the retired wrappers. Exclude the approved
adapter/bridge path; allow `snapshot.panel.showX`, `options.showX`, ECS declarations.
**Replace** the obsolete `scripts/check-frontend-ecs-blocking-panel-ownership.js` (a
growth/ownership gate whose route-through-bridge invariant dies with the wrappers) —
remove it + its test + its run-architecture-smoke wiring (like 8E removed the
target-picker-ownership guard). Wire the new guard into run-architecture-smoke
(CHECK_FILES + TEST_FILES + a run() block).

## Verification + review

- `npm run build:ecs-runtime` (bundle regenerates cleanly).
- FULL `npm test` (not just `test:architecture`) — must be 0 failures.
- `node scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js` (0 violations),
  mode-spine guard (0), `git diff --check`, lint, format:check.
- **Add a simultaneity regression test:** after `openCommandPanel('tech')` then
  `selectTechNode`, both `activeCommandPanel==='tech'` AND `techDetailOpen===true` must
  be observable in the snapshot panel facts (the bug a single-panelKey owner would cause).
- 3-lens adversarial review (behavior incl. the mutual-exclusion + the tech/techDetail
  coexistence; seal completeness; scope + guard + tests). 8E's review caught a real HIGH
  regression in a drag path — scrutinize the closePanels/blocking-detection paths similarly.
- Docs (batch-8f doc + operating plan + progress), commit, push to `private`, confirm
  deploy `rc=0`. State = `Ready for Migration Owner Review`, NOT Completed.

## Re-map note

A fresh, detailed 3-agent map of all sites was produced during planning (owner-model
proof + per-site classification). If its transcript is unavailable in the new session,
re-run an equivalent map; the decisions above are locked regardless.
