# God-file re-decomposition plan (2026-07-02)

Base = `4ff0171e` (Codex "remove legacy runtime bridges"). Goal: re-split the 4 inlined god-files
into single-responsibility modules using **plain-class composition (direct construction +
delegation)** — the `WorldClock` / `CanvasSurfaceState` / `CanvasGameAppRenderScheduler` idiom.
**Never** reintroduce `install()` prototype-mixins (Codex deliberately removed them). Target
≤600–800 lines per resulting file so a bug maps to one file (north star: one-step localization).

Targets: `CanvasGameApp.js` 4157 (32 clusters, tests good), `CanvasGameShell.js` 4006 (8 clusters,
tests thin), `CanvasGameRenderer.js` 3374 (11), `CanvasActionController.js` 2770 (17).

## Key findings

- `CanvasGameShell extends CanvasGameApp`; **142 methods defined in both**, but divergent: Shell
  reads `this.lastGame.state` (preview), App reads `this.state` (live) — e.g. `getArmyFormation`
  App:3042 vs Shell:1466. Not byte-identical → can't naively dedup.
- The dedup lever = **SHAPE-A** stateless host-passing module `Mod.fn(host)` where `host.getState()`
  resolves state uniformly; App+Shell each keep a 1-line delegator over ONE shared impl.
  `CanvasGameAppRenderScheduler` already works this way (`now(){return Mod.now(this)}`).
- `CanvasActionController` already has `getState()/getGameHost()/getPresenter()` + composes plain
  classes (`new TechTreeInteractionModel({host,getState})`); `resolveActionHandler` switch stays in
  Core, cases return handler-class methods.

## Pattern (one pattern, two shapes)

- **SHAPE-A** = stateless host-passing frozen-function module (default; timers/RAF/layout/queries;
  dedups across App/Shell). `Mod.fn(host, ...)`, host resolves state via `getState()`.
- **SHAPE-B** = stateful plain class (entityBattle, armyFormationEditor, tutorialHighlight, …):
  a `createXxxState()` factory returning a POJO of fields + a class that owns it and reaches host
  only via explicit callbacks. Composed by `this.sub = new Sub({host:this})` in the constructor.
- Prefer callers use `owner.sub.x()` directly. Add a thin single-owner delegator on the owner ONLY
  to preserve hard-to-change call sites (the 142 App/Shell overrides, switch branches, the 2 big
  test files). NEVER forward-to-forward, NEVER a mixin, NEVER copy App's impl into Shell's delegator.

## Slice order (each independently gate-green + committable)

- **PRE-1** App+Shell: add unified `getStateHost()`/`getState()` (App→this/this.state, Shell→lastGame-backed). ~20L, LOW, direct. No method moves.
- **1** App → `WorldClockTimingModule.js` (ensureWorldClock/getWorldEpochNowMs/now/wait, App:1008-1432). SHAPE-A. LOW.
- **2** App → `LoadingUiController.js` (showLoading/updateLoading/hideLoading/preloadAssets, App:1780-1899; owns `loading` blob, kills the canvasShell.loading mirror). SHAPE-B. LOW.
- **3** ActionController → `TabSwitchActionHandler` + `NamingActionHandler` + `JobAssignmentActionHandler`. ~190L. LOW.
- **4** ActionController → `AuthenticationActionHandler` + `UIModalActionHandler`. ~320L. MED. (keep cross-handler dispatch in Core.)
- **5** App → `ArmyFormationQueries.js` (read-only getArmyFormation/*Cap/*Reserve/\*EditablePool, App:3040-3134). SHAPE-A. LOW. **First real App/Shell dedup** (3042 vs 1466).
- **6** App+Shell → `ArmyFormationEditorController.js` (open/close/set/draft/save; owns armyFormationEditor blob; App:3109-3357 & Shell:1474-1600). SHAPE-B. MED.
- **7** App → `ScoutCountdownTimer` + `TileMapWaterAnimationTimer`. ~100L. MED. (water-timer tick orchestration stays in a host callback.)
- **8** App → `EntityBattleController.js` (timer/tick/input/publish, App:2131-2260; owns entityBattle+entityBattleTimer). SHAPE-B. MED-HIGH.
- **9** App → `BattleSceneController.js` (replay/animation timers, App:2429-2540; owns battleScene+battleReplayTurnTimer+battleAnimationTimer). SHAPE-B. MED-HIGH. (after 8; two battle graphs separated one at a time.)
- **10** App+Shell → `TutorialGuideUiController.js` (highlight lifecycle/target resolution; owns tutorialHighlight+highlightTimer+activeGuideNavigation+skip flags). ~240L. HIGH. (cross-cut; heaviest characterization backfill; one-shot live-verify candidate.)
- **11** ActionController → `WorldMarchActionHandler` + `TargetPickerActionHandler` (~480L). HIGH. (selectTarget→openFormationPicker→startMarch call each other → extract together; 403-tutorial-gate sensitive; one-shot live-verify candidate.)
- **12** Renderer → `HitTargetManager` (wraps surfaceState). MED.
- **13** Renderer → `WorldTileMapCacheCoordinator` (owns worldMapCacheState). MED. (94 worldMapRenderer refs; do late.)
- **14** Renderer → `CanvasLayoutService` + `CanvasAnimationEasing` (pure math). LOW.

## Test strategy (Codex deleted 19 facade/runtime test files; survivors = CanvasGameApp.test.js 42KB, CanvasGameShell.test.js 88KB, 4× CanvasActionController\*.test.js)

Per slice, characterization-first: (1) write a test exercising the god-class method BEFORE moving,
commit it green (pins behavior); (2) extract + thin delegator, re-run the SAME test unchanged —
green = read-proof of equivalence; (3) add an isolated unit test for the new module (SHAPE-A: test
with BOTH an App-like host `getState→this.state` and Shell-like host `getState→lastGame.state` to
lock the dedup contract). App-owner and Shell-owner rewires are SEPARATE commits.
Gate per slice: `npm test` ≥ baseline, architecture-smoke (incl. `git diff --check`; normalize
CRLF→LF after Edit), lint (prune stale suppressions), prettier. Only slices 10 (tutorial) and 11
(world-march, 403-sensitive) warrant one-shot live-verify; the rest must be proven by tests+read.
Needing mid-way human verify = red flag to redo the slice.
