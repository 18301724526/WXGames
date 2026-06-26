# Frontend ECS Batch 8F (Blocking Panel Mirror Removal) - 2026-06-27

## Status

| Field          | Value                                                                         |
| -------------- | ----------------------------------------------------------------------------- |
| Batch          | `8. Bridge Retirement`                                                        |
| Slice          | `8F (blockingPanel mirror removal — FULL per-panel modal subtypes)`           |
| State          | `Ready for Migration Owner Review`                                            |
| Removed mirror | 12 host fields: 10 `showX` booleans + `activeCommandPanel` + `techDetailOpen` |
| Snapshot path  | `getRendererSnapshot().panel.showX` / `getCommandPanelValue()`                |
| Guard          | `scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js`              |
| Last updated   | `2026-06-27`                                                                  |

## Decision

8F is the FINAL Bridge-Retirement slice. It retires the single `modal:blockingPanel`
umbrella and the 12 host-mirror fields it shadowed, replacing them with **one owned
ECS modal subtype per panel** (the owner-locked model). This is the ONLY slice that
touches the ECS mode-resolver core (mask + `CAPTURE_PRIORITY` + `BLOCKING_MODAL_KEYS`)
and regenerates `EcsModeRuntimeBundle.js`.

### The 12 panel keys → subtypes

`showSettings`→`modal:settings`, `showLogs`→`modal:logs`,
`showResourceDetails`→`modal:resourceDetails`, `showCitySwitcher`→`modal:citySwitcher`,
`showSubcityList`→`modal:subcityList`, `showCityManagement`→`modal:cityManagement`,
`showAdvisor`→`modal:advisor`, `showTaskCenter`→`modal:taskCenter`,
`showGuidebook`→`modal:guidebook`, `showFamousPersons`→`modal:famousPersons`,
`activeCommandPanel`→`modal:commandPanel` (payload carries the string value),
`techDetailOpen`→`modal:techDetail`. `modal:blockingPanel` removed.

### The three axes (the proven semantic model)

- **Axis 1 (mutual exclusion):** the 10 show-stars + non-`'tech'` command panel are
  mutually exclusive. Every open does `openBlockingPanelSnapshot(key)` +
  `this.closePanels([key])` → `closeBlockingPanelsSnapshot(except)` which closes all
  panels except the kept one.
- **Axis 2 (`activeCommandPanel` string):** carries capital/military/tech/…; `'tech'`
  is tech-tree base access — a general blocking overlay but **not** a tech-routing
  blocker. The raw string survives via `getCommandPanelValue()`; `=== 'tech'` /
  `!== 'tech'` compares stay raw-string.
- **Axis 3 (`techDetailOpen`, independent):** `handle_selectTechNode` sets it WITHOUT
  `closePanels`, so it overlays `activeCommandPanel === 'tech'`. Proven simultaneity;
  techDetail **is** a tech-routing blocker. A regression test
  (`…keeps commandPanel=tech and techDetail open simultaneously (Axis 3)`) pins this.

## Owner / adapter / bridge

- **ECS core:** the 12 subtypes are added to `ModeKeys.MODAL_MODE_KEYS` /
  `CAPTURE_PRIORITY`, `RendererSnapshotBoundary.MODAL_SUBTYPES`, and
  `EcsBoundaryManifest.MODE_KEYS` (existing modal bit positions preserved by appending).
  `ModeResolver.BLOCKING_MODAL_KEYS` adds the 10 show-stars + `modal:techDetail` (11)
  but **NOT** `modal:commandPanel` (its blocking-ness depends on the string value, ORed
  into `facts.blockingOverlayActive`).
- **Adapter (`CanvasModalSnapshotAdapter.js`):** new
  `openBlockingPanelSnapshot(host, panelKey, value)` (falsy/`''` routes to close — the
  toggle-via-open contract), `closeBlockingPanelSnapshot`,
  `closeBlockingPanelsSnapshot(except)` (Axis-1, single snapshot rebuild),
  `isBlockingPanelSnapshotOpen`, `getCommandPanelValue` (raw string),
  `buildBlockingPanelFacts`.
- **Bridge (`CanvasModeOwnershipBridge.js`) — the source flip:**
  `buildRendererPanelFacts` now DERIVES the flat-12 facts from the per-panel modal
  entries (passed the same `modalWorld` the snapshot is built from), instead of reading
  a shell/game/host mirror. The 3 wrappers
  (`openBlockingPanelOwner`/`closeBlockingPanelOwner`/`closeBlockingPanelsOwner`) and the
  mirror helpers were removed; `collectModalKeys` pushes each open subtype.

### Plan gaps caught during execution (preserved exactly)

- **`tutorialAdvisorDialogue` and `armyFormationEditor.open`** were folded into the old
  umbrella but are NOT panels. They are preserved as explicit OR terms in
  `deriveModeFacts.blockingOverlayActive` and `hasBlockingOverlayExceptTechTree`, and as
  a `NON_PANEL_CLOSEABLE` residual in `CanvasActionController.closePanels` (alongside the
  `closeEventSnapshot` side-effect, gated on `activeEventId`).
- **`deriveModeFacts.techTreeActive`** still read the raw `activeCommandPanel === 'tech'`
  mirror; flipped to `getAnyModalPayload(host, 'modal:commandPanel')?.value === 'tech'`.

## Migration surface

~26 source files migrated (handlers, controllers, commands, system UI, guide UI,
rendering runtimes, input routers, constructors, tutorial coordinator/registry/
controller, territory, GameCommandService). Behavior-preserving rules applied:
opens/closes route through the adapter (local `*BlockingPanelSnapshot` helpers that
prefer the host method, else the module adapter); cross-host mirror writes dropped as
redundant (the adapter fans out across related hosts); SUBSET resets preserve their
EXACT panel subset (no broadening to close-all); rendering-runtime option-builders
source `options.showX` from `getRendererSnapshot().panel`; input-router blocking-overlay
reads flip to `isBlockingPanelSnapshotOpen` / `getCommandPanelValue` with the field set
and tech carve-out preserved; constructor mirror initializers deleted; out-of-scope
domain state (`techUiState.detailOpen`, `selectedTechId`, the `*Tab` cursors,
`armyFormationEditor` object, `territoryUiState`) untouched.

## Guard upgrade

`scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js` is a new blocking
guard (modelled on the event/targetPicker retirement guards). It forbids `<host>.showX`
/`<host>.activeCommandPanel`/`<host>.techDetailOpen` mirror access off the mirror hosts,
the `setIfChanged(host,'showX',…)` and `{ showX: false }` / `{ activeCommandPanel: '' }`
patch-key idioms, and the 3 retired wrappers. The bridge + adapter are approved paths.
Reads of `snapshot.panel.showX` / `options.showX` / `panel.showX` and the adapter calls
are allowed.

Hardened per the adversarial review: WRITE detection is receiver-agnostic
(`.showX = …` and `host['showX'] = …` regardless of receiver), so aliased fan-out vars
(`target.showX`, `relatedHost.showX` — the identifiers the adapter's own related-host
fan-out uses) cannot smuggle a mirror back in; reads stay anchored to the mirror hosts to
avoid flagging `panel.showX` reads. The patch-key suppression is file-scoped to
`RendererSnapshotBoundary.js` (whose `PANEL_DEFAULTS` declares `showX: false`), not the
whole `frontend/js/ecs/` subtree.

The obsolete `scripts/check-frontend-ecs-blocking-panel-ownership.js` (a growth/ownership
gate whose route-through-bridge invariant died with the wrappers) was removed with its
test and its `run-architecture-smoke` wiring.

## Verification packet

Executed before `Ready for Migration Owner Review`:

- `npm run build:ecs-runtime` (bundle regenerated cleanly)
- `node scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js` (0 violations, 226 files)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `npm run test:architecture` (all guards + focused tests passed)
- `npm test` (full suite, `1701` tests, 0 failures)
- `npm run lint` (clean)
- `npm run format:check` (clean)
- `git diff --check` (clean; all changed files LF)

A three-lens adversarial review (behavior preservation incl. the Axis-1 mutual exclusion
and the Axis-2/Axis-3 tech / techDetail coexistence; seal completeness; scope + guard +
test fidelity) was run on the diff, with each of the 12 raised findings adversarially
re-verified. **Zero live behavior regressions** were confirmed in the refactor itself;
the 3 confirmed findings were all guard-soundness gaps in the new regex backstop and were
applied (receiver-agnostic write detection, file-scoped patch suppression, boundary
tests).

## Outcome

8F completes the Bridge Retirement batch: all six modal mirrors
(`battleScene`/`naming`/`confirmDialog`/`rewardReveal`/`event`/`targetPicker`) plus the
12 blocking-panel fields now flow through owned ECS modal subtypes. The renderer reads
`snapshot.panel.*`; no host-mirror panel fields remain.
