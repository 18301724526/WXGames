# 10 — March-Discovery Refactor (delete directional scout → pre-placed cities + vision discovery)

> Task **#53** (`行军发现重构: 删定向侦察 + 预置城 + 视野发现`).
> Goal: **DELETE** the directional-scout-spawns-a-city mechanic; **PRE-PLACE** cities in the one
> shared canonical world (terrain already frozen from a seed); **DISCOVER** them via a marching
> army's VISION. Reuse the 野怪营地 pre-placed-entity pattern. Rework the tutorial to march-discovery.
>
> This is the implementation map that ties six domain scans together. Every claim is anchored to
> `file:line` so a slice can be started without re-reading the scans.

---

## 0. One-paragraph mental model

Terrain is **already** a pure function of one frozen seed, and delivery is **already** reveal-streamed
per player — so "one shared canonical world" needs almost no new code (§2.4). The two real mechanics to
build are: **(A) a deterministic city-placement authority** modelled on `WorldCampSpawner.planCamps`
but writing **shared-world territory objects** (not per-player encounters), and **(B) a generic
"march vision reveals a pre-placed city → discovery" hook** inside `revealStep`, replacing the
per-mission `plannedSites` materialization that today *invents* the tutorial city along the route.
The garrison / conquest / ②b-capture chain is **generic over `gameState.territories`** and needs
**zero** change — a pre-placed neutral city slots in the moment it flows through `normalizeTerritory`
(§2.3). The directional scout system (`scoutTerritory`/`claimScout`) is **unwired from the tutorial**
and deletable independently (§1, §6-R1).

---

## 1. DELETE — scout system + blast radius (ordered)

> **§1.0 CodeGraph-verified before cut (2026-07-06):**
> - **4 pure modules** (`TerritoryScoutPlanner/Results/Areas/Records`) have **no non-scout production caller** — only `TerritoryService` composes them + tests + smoke manifest. Deletable whole. ✅
> - **`getScoutOrigin` = KEEP** (codegraph showed "1 caller" but `TerritoryQueries.js` was stale in the index; grep proves `TerritoryClientAssembler` consumes it for the `scoutOrigin`/`originDistance` DTO — an origin-distance util reused beyond scouting). §1.6-4 correct. ✅
> - **`TerritorySiteMigration.js:23-24,163-164`** consumes `getDirectionProgressScore/getTerrainSiteScore` (legacy scout-site scoring) → dies with scout. Confirmed. ✅
> - **⚠️ Bigger-than-"15-files" cascade discovered:** `TerritoryService:23-177` weaves **~30 destructured scout fns** (`normalizeScoutState/normalizeScoutReports/upsertScoutAreaRecord/…`) that are **passed INTO other factories** (`TerritoryStateNormalizer` + `TerritoryMilitaryMissions` composition, `:129-140`). Deleting them cascades into those factories' dep-lists AND the fns inside them that consume scout state. **Untangle order:** action seam → strip scout fns FROM the StateNormalizer/MilitaryMissions factory dep-lists (and the scout branches inside) → THEN delete the 4 modules + `TerritoryService` scout fns → THEN constants.
> - **⚠️ `SCOUT_SITE_MIN_DISTANCE` is used by a KEPT fn** (`TerritoryQueries.getSiteSpacingProfile:78`, site-spacing — reused by pre-placed-city min-spacing). Do NOT blanket-delete it with the other `SCOUT_*` constants; keep or rename to `SITE_MIN_DISTANCE`. Same-check `MAX_SCOUT_DISTANCE` (used by `getNearestSiteDistance:72` fallback).
> - **Execution note:** this is a genuine multi-iteration atomic untangle — best run on **fresh context runway** so it lands as one gate-green commit, never a half-torn tree.


**Ordering rule:** rip the *action seam* first (so nothing new can reach the code), then the *service
public fns*, then the *pure modules*, then *surgically de-scout* the mixed files, then *frontend*, then
*tests + manifest* — all deletes for a given layer in **one commit** so the architecture-smoke MANIFEST
name-asserts (`TerritoryArchitecture.test.js:48-51`) never straddle a broken state.

> ⚠️ **Do NOT delete anything named "scout" that belongs to the REPLACEMENT system.** Five explicit keeps
> in §1.6.

### 1.1 Action seam (do first — cuts all reachability)
| Delete | Where |
|---|---|
| `scoutTerritory` block | `backend/actions/TerritoryAction.js:46-53` |
| `claimScout` block | `backend/actions/TerritoryAction.js:63-65` |
| `'scoutTerritory'`,`'claimScout'` from `TERRITORY_ACTIONS` | `backend/actions/GameActionRegistry.js:14-15` |
| `'scoutTerritory'`,`'claimScout'` PASS_THROUGH entries | `backend/config/TutorialFlowConfig.js:21-22` |

### 1.2 `TerritoryService` public fns + factory wiring (surgical)
`backend/services/TerritoryService.js` — delete `startScout(365-429)`, `claimScout(431-448)`,
`scoutTerritory(450-452)`, `resolveScoutMissionTarget(247-363)`, the 4 scout-factory instantiations
(`52,72,88,174`) + destructured names, `SCOUT_*` imports (`10-13`), and exports (`505-522`).
**KEEP** `getScoutOrigin` import (`41`) — the assembler reuses it (§1.6-4).
Verify `normalizeDirection(242-245)` against migration reuse before removing.

### 1.3 Pure scout modules — DELETE WHOLE (4 files)
| File | Sole callers / blast |
|---|---|
| `backend/services/territory/TerritoryScoutPlanner.js` | `TerritoryService.js:174,375`; `run-architecture-smoke.js:20`; `TerritoryArchitecture.test.js:690` |
| `backend/services/territory/TerritoryScoutResults.js` | `TerritoryService.js:88` + `resolveScoutMissionTarget`; **exports `getDirectionProgressScore`/`getTerrainSiteScore` are also consumed by `TerritorySiteMigration.js:102-103` — trace migration first (likely scout-legacy, dies too)** |
| `backend/services/territory/TerritoryScoutAreas.js` | `TerritoryService.js:52`; deps injected into ScoutRecords + `TerritoryMilitaryMissions.js:122` |
| `backend/services/territory/TerritoryScoutRecords.js` | `TerritoryService.js:72`; feeds normalizer scout-field normalizers |

### 1.4 Surgically de-scout the MIXED backend files (scout is ONE seam beside soldier/conquest)
| File | Delete (keep the rest) |
|---|---|
| `backend/services/WorldMapService.js` | `getScoutRevealArea(274-344)`, `revealScoutArea(346-348)`, `buildScoutRoute(371-388)`, `recordScoutTrail(390-404)`, `normalizeScoutTrail(54)`, `scoutTrails` field (`87,144-146,162`), exports (`469,470,482,483`). **KEEP `getRevealArea/revealTileArea/revealTiles`** (generic reveal used by vision/conquest). |
| `backend/services/worldMap/WorldMapConstants.js` | `SCOUT_REVEAL_MAIN_LIMIT/BRANCH_LIMIT/TILE_LIMIT(11-13)`,`SCOUT_REVEAL_BRANCH_SIDES(55)`,`DIRECTION_VECTORS(45)`+exports(`77-81`). **KEEP `SCOUT_REVEAL_RADIUS(10)`** (feeds generic `getRevealArea`). |
| `backend/services/territory/TerritoryConstants.js` | `SCOUT_DURATION_MS/SCOUT_STEP_DURATION_MS/SCOUT_ACTION_POINTS/MAX_SCOUT_DISTANCE/MAX_ACTIVE_SCOUTS/SCOUT_SITE_*/MAX_SCOUT_AREA_RECORDS/MAX_REPORTS` + exports. **KEEP `SITE_ART(43)/SITE_TEMPLATES(52)/SOLDIER_SCALE`** (normalizeTerritory reuses). Trace `DIRECTIONS(32-41)` before removing (DTO `directions` list). |
| `backend/services/territory/TerritoryStateNormalizer.js` | scout branch of `normalizeWarMissions(163-247)` (KEEP conquest branch `248-270`), scout field normalizations (`372-374`), `syncScoutCoordinatesWithTerritories(275-298)`+call(`378`), `enforceScoutMissionLimit` call(`379`), scout deps in factory dep-list. |
| `backend/services/territory/TerritoryMilitaryMissions.js` | `getScoutMissions(22)`,`getActiveScoutMission(26)`,`countActiveScoutMissions(30)`,`advanceScoutMission(132-177)`,`enforceScoutMissionLimit(192-205)`; strip scout arm from `updateMissionReadiness(182-184)` + `getMissionKind(18-19)`; remove `ensureMissionRevealArea/isDirectionalScoutAreaMission` deps(`14-16`). **KEEP all soldier/conquest fns.** |
| `backend/services/TerritoryClientAssembler.js` | `getClientScoutAreas(87-105)`+export(`241`), DTO fields `scoutMissions/activeScoutMission/scoutReports/scoutAreas/maxActiveScouts/scoutDurationSeconds/directions(214-232)`, `scoutMissions` filter(`205`). **KEEP `scoutOrigin/originDistance`** (getScoutOrigin util). |

### 1.5 Frontend (surgical) + save-migration
| File | Delete |
|---|---|
| `frontend/js/api/GameAPI.js` | `scoutTerritory(665)`, `claimScout(666)` |
| `frontend/js/controllers/TerritoryController.js` | `handleScoutAction(230-238)`, `onScoutAction(68)` |
| `frontend/js/platform/CanvasActionController.js` | dispatch cases(`434-435`), `handle_scoutTerritory(975-986)`, `handle_claimScout(988-999)` |
| `frontend/js/state/presenters/MilitaryPresenter.js` | `buildScoutControlViewState(256-370)`; verify `formatScoutCountdown/getScoutMissionRemainingSeconds` NOT shared by conquest countdown before deleting (§6-R5) |
| `frontend/js/platform/renderers/MilitaryCanvasRenderer.js` | scout compass grid + hit targets (~`330-408`) |
| `frontend/js/state/presenters/WorldTileMapPresenter.js` | directional `activeScouts(353-383)` + `scoutAreas(388-407,431)` + `scoutMissions` reads(`84,353`); change merge line `430` to `explorerScouts`-only. **KEEP explorerScouts path.** |
| `frontend/js/state/GameStateManager.js` | `scoutMissions/scoutReports/directions` defaults(`66-68`) if unconsumed |
| `frontend/js/ecs/projection/WorldMapRenderSnapshot.js` | `scoutAreas(200,216,242)` if removed upstream |
| `frontend/js/config/LocaleTextRegistry.js` | `military.scout.*` panel keys. **KEEP `tutorial.*` scout keys** (world-march chain, §1.6-2) |
| **Persisted save keys** | `scoutState`,`scoutReports`,`scoutedCoordinates`,`worldMap.scoutTrails`,`warMissions[kind=='scout']` — add a **drop-unknown-keys** normalizer step; the `scoutReports` DB column read at `GameStateRepository.js:221` must tolerate NULL/legacy (§6-R6) |

### 1.6 KEEP — these carry "scout" in the name but are NOT the directional-scout system
1. **World-explorer / world-march** (`WorldExplorerService`, `WorldAiExplorerService`, `WorldExplorerRoutePlanner`) — the REPLACEMENT discovery system. Only uses the string literal `visibility:'scouted'` (a tile state).
2. **Tutorial scout steps** (`scoutFormationSaved`, `hasTutorialScoutFormation`, `TutorialGuideFlowRegistry` `scout-*` rules) — they drive `startWorldMarch`, NOT `scoutTerritory` (proven `TutorialGuideFlowRegistry.js:699-709`). Renamed scaffolding — leave intact (unless §3.3 loosens the scout-PERSON requirement).
3. **`WorldMapScoutRenderer.js`** — the world-march ROUTE renderer; reads generic `actor.route/status`. It becomes the render path the replacement plugs into. **Do NOT delete.**
4. **`getScoutOrigin` (`TerritoryQueries.js:37`)** — shared util for the `scoutOrigin` DTO + every territory's `originDistance/relativeX/relativeY`.
5. **`visibility:'scouted'` tile state + `getRevealArea/revealTileArea/revealTiles` + `SCOUT_REVEAL_RADIUS`** — generic reveal used by conquest/vision. `ScoutCountdownTimer.js` is MIS-NAMED (generic military/conquest 1s re-render timer) — KEEP.

### 1.7 Tests + manifest (same commit as the deletes)
`scripts/run-architecture-smoke.js` MANIFEST allowlist (drop the 4 modules; **keep `WorldMapScoutRenderer`**);
`backend/tests/TerritoryArchitecture.test.js` require + name-check the 4 factories (`19-22,48-51`) and scout unit blocks (~`275,377,466,690,767,806-880,955-1007,1355-1378,1569-1584`);
frontend `UIStatePresenter.test.js` scout cases, `MilitaryCanvasRenderer.test.js:238-240`, `CanvasActionControllerTerritory.test.js`.

---

## 2. REUSE — the machinery that already exists (do not rebuild)

### 2.1 野怪营地 deterministic pre-placed-entity PATTERN (copy the shape, change the storage)
The camp layer is the exact template for the city placement authority. Verified in
`backend/services/worldCombat/WorldCampSpawner.js`:
- `planCamps(seed, capitalCoord, opts):71` — **pure** deterministic ring-walk placement.
- `iterateRingCoords(capital,minRing,maxRing):35` — fixed `(dr outer, dq inner)` order → stable global layout from per-tile rolls.
- Per-tile gate: `roll01(seed,q,r,'camp-place') >= densityRoll` skip (`:87`); `isMarchBlockedTerrain` skip (`:90`); `occupiedTileIds.has(tileId)` skip (`:93`); Chebyshev `minSpacing` skip (`:95`).
- `seedCampEncounters(gameState,now):205` — **idempotent one-time** fold-in (`hasAnyCamp` short-circuit + id-merge never-overwrite).
- `collectOccupiedTileIds:119` — reserve capital + all `gameState.territories` tiles before placing.
- Tuning tables single-sourced in `backend/config/WorldCampConfig.js` (`CAMP_ARCHETYPES/PLACEMENT/RING_ARCHETYPE_BANDS`).

> **The one thing NOT to copy:** camps store **per-player** inside the `worldCombat` JSON column
> (deterministic, so every player recomputes the same set). A **shared** city must NOT do that — see §4.

### 2.2 Garrison / conquest / ②b-capture chain — GENERIC, zero change
A "site" = an entry in `gameState.territories`; the tile↔site link is the one-way pointer `tile.siteId`
(no embedded `tile.site`). Garrison/attackability is **100% re-derived** on every load from
`{id,x,y,owner,type}` + `capitalDistance`:
- `TerritoryStateNormalizer.normalizeTerritory:78` is the single funnel — stamps `capitalDistance:147-148`, re-derives `garrison:149`, `defenderLeader:150`, `battleTarget:151`.
- `TerritoryCombatTargets.normalizeGarrison:32` — neutral branch (`44-72`) emits the full band garrison incl. `captureChance/recruitBaseRate/leader` the ②b hook needs.
- `GarrisonPolicy.isNeutralCityDefended:28` — single defended/undefended decision (band by Chebyshev distance from `worldMap.origin`, `garrison.json` bands: `safe≤3` undefended, `near 4-8` defended).
- `GarrisonCaptureResolver.maybeCaptureOnVictory:54` (called `TerritoryConquestMissions.js:219`) — ②b capture fires automatically for any city whose band gives `captureChance>0`.

**A pre-placed city needs to AUTHOR ONLY:** `id` (≠`'capital'`), `x`,`y` (≠`0,0`), `owner:'neutral'`,
`type` (a key in `SITE_ART`), `status:'discovered'`. Do **NOT** hand-author `garrison/defenderLeader/capitalDistance/battleTarget` — they are overwritten by `normalizeTerritory` (§6-R4). To be a **combat target** the city must sit **>3 rings from the actual capital `worldMap.origin`** (not world 0,0 — capital spawns off-origin, the garrison-②a trap). The register-into-world idiom is `gameState.territories.push(site)` + `WorldMapService.bindSiteToTile(...)` (`TerritoryService.js:356-357`). Canonical shape to mirror: `TerritoryInitialState.createCapital:16` and the existing site literal `TerritoryScoutResults.js:349-375` (note its 2-line `garrison = normalizeGarrison(null, site, ...)` seed — which our pre-placed path does NOT copy, since normalize does it).

### 2.3 March-vision reveal hook — the seam to generalize
`WorldExplorerProgression.revealStep:201` is THE per-step vision hook (verified). Per due route step it:
1. expands the step coord to a Chebyshev square via `getRevealArea(step.q,step.r,EXPLORE_REVEAL_RADIUS)` (radius=1, `WorldExplorerShared.js:14`) and `revealTiles(...)` with `visibility:'scouted'` (`:202-221`);
2. calls `materializePlannedSitesForStep:117` — which today discovers a city **only** if it is on `mission.plannedSites` (`:123-124`), and even **guards against** binding when another territory already occupies the coord (`:130-132`).

**The gap** (verified at `:123-132`): a city pre-placed independently of the mission is **not** auto-discovered by simply entering the 3×3 reveal area. The new generic pass must scan revealed coords against **all** pre-placed cities (`gameState.territories` + `options.planningContext.sharedWorldTerritories`, read at `:109-111`), using the existing coord→territory lookups `findTerritoryAtCoordinate:100` / `findPlanningTerritoryAtCoordinate:107`, and `bindSiteToTile` + set `status:'discovered'` for any whose tile just entered vision.

### 2.4 Deterministic terrain / one canonical shared world — ALREADY DONE
- `chooseTerrain(seed,q,r)` (`WorldMapTiles.js:93`) is pure — no RNG state, no time, no per-player input. `roll01(seed,q,r,salt)` (`WorldMapGenerationAuthority.js:87`).
- Single seed `DEFAULT_WORLD_SEED='world-seed-v1'` (`WorldMapConstants.js:3`) pinned by `getSeed:120`. Today's live world **is** effectively one canonical seed.
- Storage is already split: `global_world_tiles` (shared canonical, per-player identity stripped, `WorldMapAuthorityRepository.js:70-93`) + `player_world_visibility` (per-player reveal). Delivery is reveal-streamed (`getPlayerVisibleTiles:349` JOIN; hidden tiles dropped `WorldMapService.js:406/422`).

**So "one shared canonical world" requires essentially no work** for terrain. Optional hardening (only if you want the world frozen against *future algorithm edits*): pre-generate `global_world_tiles` eagerly via a bounded seed sweep of `upsertGlobalTile(createTile(seed,q,r))` and stop the water-family self-heal recompute (`getNaturalGlobalTerrain WorldMapAuthorityRepository.js:58`, `getAuthoritativeLandTerrain WorldMapTiles.js:88/261`). **This is out of scope for #53** unless a slice explicitly wants the freeze; the city refactor does not need it (§6-R7).

---

## 3. NEW pieces to build

### 3.1 `WorldCitySpawner` — deterministic, distance-banded, SHARED-world placement authority
Copy the **shape** of `WorldCampSpawner.planCamps`, change the anchor + the storage:
- **Pure planner** `planCities(worldSeed, worldAnchor, opts)` — ring-walk (`iterateRingCoords` shape), per-tile `roll01(worldSeed, q, r, 'city-place')` density gate, `isMarchBlockedTerrain` skip, `minSpacing` skip, `occupiedTileIds` skip.
- **Anchor is WORLD-level, not any one player's capital** (§6-R3). Camps key off the player's capital coord; a SHARED city layout must key off a fixed world anchor/seed so all players see the same cities.
- **Distance band** is the placement gate that decides attackable-vs-settlement: place cities at Chebyshev distance from `worldMap.origin` that lands them in the `near/frontier/deep` bands (`>3`, `garrison.json`). A tutorial "first city" is placed deliberately just outside `safe` but near the explore origin (see `getExploreOrigin RoutePlanner:27-41` for the origin to place near).
- **Emit the minimal raw territory** (§2.2): `{id:'site_<q>_<r>' (or city_<name>), x, y, owner:'neutral', type (∈SITE_ART), status:'discovered', naturalName, scale, mapTerrain}` — no garrison authoring.
- **Idempotent seeder** `ensureCitiesSeeded(...)` — `ensure*` style, id-keyed merge, never re-push (§6-R8). Mirror `seedCampEncounters`'s `hasAny` short-circuit.
- **Tuning table** — parallel constant module or a config table per `docs/design/05` (Excel→generated JSON pipeline). Bands/counts/min-spacing single-sourced there.
- Placement collision reservation must include **the shared spawn allocation table** (`player_spawn_allocations`) + other AI capitals, not just the current player's territories (§6-R3, `docs/design/05 §5.2`).

### 3.2 Shared-world neutral-city STORAGE + PROJECTION (the real gap)
**Discovered during verification:** `saveSharedWorldTerritories` (`GameStateRepository.js:508-521`) today
persists **only player-owned** territories — `getSharedTerritoryOwner:500` returns `''` for neutral/capital,
and `:517-518` skips any territory with no owner. So the existing `shared_world_territories(id PK, territory
JSON, ownerPlayerId, updatedAt)` table (`:141`) does **not** currently hold neutral pre-placed cities, and
`getSharedWorldTerritories:478` / `getClientProjectionForPlayer:232` only carry owned ones.

**New work:** a shared **neutral-city** storage row + projection so every player discovers the *same* pre-placed
cities. Two options, decide in the design slice:
- (a) seed neutral cities into `shared_world_territories` with a sentinel `ownerPlayerId` (e.g. `''`→needs the skip at `:518` relaxed for a `neutral` flag) and project them into every player via `getSharedWorldTerritories`; or
- (b) a dedicated `world_cities` table + `AiFactionSeeder.ensureSeeded` (per `docs/design/05 §5.2`) whose init registers alongside `GameStateRepository.js:141`.

Either way the projection must feed `options.planningContext.sharedWorldTerritories` (already read at
`WorldExplorerProgression.js:109-111`) so §3.4's discovery pass sees them, and feed the client DTO
(`getClientTerritoryState`) with **visibility gated** (a pre-placed neutral city is `hidden` until discovered — §6-R2).

### 3.3 Tutorial rework — "march to a pre-placed nearby city"
The tutorial does **not** use `scoutTerritory` (§6-R1). Its "scout" is a NAMED PERSON in formation slot 1
who runs `startWorldMarch`, whose route today **invents** the first city. The 6 steps
(`shared/tutorialFlowConfig.js STEP_ORDER 42-47`: `scoutFormationSaved, scoutWorldPanelOpened,
scoutExploreStarted, firstCityDiscovered, firstCityConquestStarted, firstCityOccupied`) **stay** — only the
events feeding `scoutExploreStarted`/`firstCityDiscovered` move from materialization to vision.

**Replace** (verified engine):
- `WorldExplorerRoutePlanner.js`: `shouldGuaranteeTutorialEmptyCity(246-255)`, `createTutorialEmptyCitySite(262-295)`, `createTutorialPlannedSites(297-334)`, `pickTutorialCityName(257)`, `TUTORIAL_EMPTY_CITY_NAMES`.
- `WorldExplorerActions.js:216-240`: the `createTutorialPlannedSites` call + `shouldGuaranteeTutorialEmptyCity` guard + `EXPLORE_TUTORIAL_TARGET_OCCUPIED` + **route-truncation-to-invented-city** block (verified `:227-239`).
- `WorldExplorerProgression.materializePlannedSitesForStep:117-163` grant-write branch (`:142-154`) — the `firstExploreEmptyCity` grant.

**With:**
- Pre-place the tutorial city at world-init/seed time (§3.1) at a deterministic tile near `getExploreOrigin`, and set `tutorial.grants.firstExploreEmptyCity = {siteId}` **at grant time** (grant key single-source `TUTORIAL_FIRST_SITE_GRANT_KEY`, `WorldExplorerShared.js:15`).
- Fire `firstCityDiscovered` from the **vision reveal** of that pre-placed city's tile (§3.4), not from `advanceTutorialAfterGuidedExplore`'s "whole route revealed" trigger (`Progression:247-253`). **Preserve the convergent/idempotent re-fire property** (comment `:243-246`) or missions strand at `scoutExploreStarted` (§6-R... tutorial convergence).
- Keep ALL conquest gating AS-IS: `TutorialActionValidator.validateFirstCityGuideAction(160-220)`, `TerritoryAction` advances `firstCityConquestStarted/firstCityOccupied/firstCityNamed(66-97)` — they key off the grant + step, not scout.
- **Frontend guide** (`TutorialGuideFlowRegistry` `scout-select-world-target:669-681`) must steer the player to the pre-placed city's tile, else they march elsewhere and never trigger discovery (§6-R-route).
- **Decision:** the upstream scout-PERSON+formation segment (`scoutFamousGranted..scoutFormationSaved`, `main_scout_officer` task, `hasTutorialScoutFormation` gate, `validateScoutExploreAction:146-158`, `WorldExplorerTutorial.validateTutorialFormation:4-19`). Keep it (march must be done by the scout officer in slot 1) OR loosen it (any army). If loosened, delete the scout-person branch in those 4 places + frontend `scout-*` person rules (`FlowRegistry:587-668`) — but **re-verify the empty-formation gate still blocks a 0-soldier march** (§6-R-403). Bump `TutorialFlowConfig.CONFIG_VERSION` (major) and pass `check-tutorial-step-contract`/`check-tutorial-advance-single-source`.

### 3.4 March-vision → discovery HOOK (the generic pass)
Add inside `WorldExplorerProgression.revealStep` right after `revealTiles(...)` produces `coords`
(seam `:202-221`), OR fold into `materializePlannedSitesForStep` (already receives `revealTileIds` + `planningContext`):
- iterate the revealed coords against pre-placed cities (`gameState.territories` + `options.planningContext.sharedWorldTerritories`), reusing `findTerritoryAtCoordinate:100` / `findPlanningTerritoryAtCoordinate:107` and `createTileIdSet:74`;
- for each city whose tile just entered vision and is not yet discovered: `WorldMapService.bindSiteToTile(gameState, x, y, id, now, {visibility})` + set `status:'discovered'`, **visibility reflecting NOT-owned for enemy/neutral** (separate discovery from ownership — §6-R-guard);
- **record a persistent `'city'` vision source** via `WorldMapVisionHistory.recordSource:87` so the fog layer treats it as permanently revealed, not transiently lit by the passing unit source that decays (§6-R-fog);
- flow the newly-discovered tiles into `newlyRevealedTiles` + `mission.revealedTileIds` (existing pattern `:286-290`) so the client sees it;
- **idempotent** — guard on `status` already `'discovered'` / site already bound; `advanceExploreMissions` runs on every tick AND action write (§6-R-idem).
- **Rework the `:130-132` occupy guard** — today it SKIPS binding when a pre-placed territory sits on the coord; for "vision discovers the pre-placed city" the intent inverts: the city IS discovered, not skipped.

---

## 4. SINGLE-SOURCE design (the invariants this refactor must hold)

1. **One placement authority.** Cities are placed by exactly one deterministic function
   `WorldCitySpawner.planCities(worldSeed, worldAnchor)` — pure, keyed off a **world-level** anchor (not
   a player capital). No second city generator. (The frontend `tile-map-lab.js:550 chooseTerrain` is a
   different NOISE algorithm — a standalone tool, must not leak into the shared world.)

2. **Cities live as shared-world territory entities on tiles.** A city is a `territory` object in the
   shared store (§3.2), linked to its tile by the **one-way** `tile.siteId` (`bindSiteToTile` is the only
   writer). There is no embedded `tile.site`. The shared store is the single copy — N players must not
   fork N neutral copies (§6-R-storage).

3. **Discovery is vision-only, written through one path.** Tile-discovered state is written ONLY via
   `WorldMapService.revealTile/revealTiles/bindSiteToTile`; fog memory ONLY via
   `WorldMapVisionHistory.recordSource/recordPath`. Discovery (`status:'discovered'` + visible) is
   **separate** from ownership (`owner`/`ownerPlayerId`/`controlled`).

4. **Attackability is derived, never authored.** `normalizeTerritory` re-derives
   `capitalDistance/garrison/defenderLeader/battleTarget` every load. The placement authority authors
   ONLY `position + owner + type + status + names`. Hand-authored garrison values are overwritten.

5. **Idempotent seeding.** `ensureCitiesSeeded` is `ensure*`-style (id-keyed, never re-push), safe on
   every normalize (init/load/tick), matching `seedCampEncounters`.

6. **Grant is the tutorial first-city single source.** `tutorial.grants.firstExploreEmptyCity` is the one
   identity, consumed by `getTutorialFirstEmptyCityId(TutorialSelectors.js:97)`,
   `TerritoryAction.isTutorialFirstCity(7)`, `validateFirstCityGuideAction`, and frontend
   `getFirstExploreCityId` (×3 mirrors). Set it at pre-placement/grant time, not at materialization.

---

## 5. ORDERED SLICE PLAN

Each slice: **characterization test (lock current behavior) → read-proof of equivalence → implement →
gates green → (if it touches live behavior) ONE-SHOT user live-verify**. No debt-for-safety: needing
mid-way human verification = red flag to decouple, not paper over. LF line-endings + `npm run lint`
before every push; deploy to both `design` + `refactor`/`local` per the WSL mirror.

| # | Slice | Touches live behavior? | Live-verify? | Notes / gate |
|---|---|---|---|---|
| **S0** | **Evidence + characterization baseline.** Lock current behavior with tests: `WorldExplorerService.test.js` (materialization + `firstCityDiscovered`), `GameRoutesTutorial.test.js` (full playtest `761/1052/1119/1138`), `TerritoryActionTutorial.test.js`, `TerritoryArchitecture.test.js` scout blocks. Capture a fog/vision baseline. | No | No | Pure test add. This is the read-proof anchor for every later delete. |
| **S1** | **Delete directional scout (backend + frontend + tests + manifest).** §1 in order. Independent of everything else (unwired from tutorial). Add drop-unknown-keys save-normalizer for `scoutState/scoutReports/scoutedCoordinates/worldMap.scoutTrails/warMissions[kind=scout]`. | **Yes** (removes Military-tab scout UI + persisted keys) | **Yes** — 1-shot: load a save with scout keys, confirm round-trip clean + Military tab renders + conquest timers still tick + architecture-smoke `git diff --check` clean. | Mixed-file surgery (`MilitaryMissions`, `StateNormalizer`) — re-run conquest tests. §6-R1/R5/R6. |
| **S2** | **`WorldCitySpawner` pure planner + tuning table.** `planCities(worldSeed, worldAnchor, opts)` copying `planCamps` shape; deterministic, distance-banded, world-anchored. No wiring yet. | No | No | Pure fn + config. Test: same seed→same layout; all cities `>3` from anchor land in defended bands; none on march-blocked terrain; min-spacing honored. §3.1, §6-R3. |
| **S3** | **Shared neutral-city storage + projection.** §3.2 — extend `shared_world_territories` (or new `world_cities` table) to hold neutral cities; project into `getClientProjectionForPlayer` + `planningContext.sharedWorldTerritories`; **visibility-gated** in the client DTO (hidden until discovered). | **Yes** (new rows + client DTO) | **Yes** — 1-shot: confirm two players see the SAME cities, and an undiscovered city is NOT in the client map (no reveal-at-spawn regression). | §6-R2/R-storage. Idempotent seeder wired at `GameStateNormalizer` create(`:86`)/load(`:134`)/tick(`:163-167`). §6-R8. |
| **S4** | **March-vision → discovery hook (generic, non-tutorial).** §3.4 — generalize the discovery pass to `gameState.territories` + `sharedWorldTerritories`; record `'city'` vision source; idempotent; rework the `:130-132` occupy guard. | **Yes** (any march now discovers pre-placed cities) | **Yes** — 1-shot: march an army so a pre-placed city enters the 3×3 radius → it flips to `discovered`, is bindable, becomes an attackable garrison, ②b capture fires on victory. Verify fog treats it as permanent. | §6-R-fog/R-guard/R-idem/R-radius. `revealStep/advanceExploreMissions` have ⚠️ no direct tests — S0 must cover them. |
| **S5** | **Tutorial rework to march-to-pre-placed-city.** §3.3 — delete the invent-city engine + route-truncation; pre-place the tutorial city + set the grant at init/grant time; fire `firstCityDiscovered` from vision (S4). Decide + apply the scout-PERSON keep/loosen. Bump `CONFIG_VERSION`. | **Yes** (the tutorial critical path) | **Yes (HIGH)** — full playtest on the **refactor** server (not prod — the +4 step-shift trap): capital → scout officer in slot 1 → march → reveal pre-placed city → `firstCityDiscovered` → conquest → occupy → name. | §6-R-tutorial-convergence/R-403/R-route/R-grant-timing. Update (don't delete) tutorial characterization tests. Heaviest slice; keep it last. |
| **S6** *(optional)* | **Freeze hardening.** Eager-materialize `global_world_tiles` seed sweep + retire water-family self-heal recompute so the frozen world is immune to future `chooseTerrain` edits. | Yes | Yes | **Out of scope for #53** unless explicitly wanted. §2.4, §6-R7. Independent; can ship anytime after S2. |

**Dependency order:** S0 → S1 (parallel-safe) ; S0 → S2 → S3 → S4 → S5. S1 is independent of S2-S5. S6 optional after S2.

---

## 6. TOP RISKS + containment

- **R1 — Dual "scout" meaning (the #1 trap).** Directional `scoutTerritory/claimScout` (Military tab, unwired) vs the tutorial scout PERSON + world march. *Contain:* S1 deletes only the directional system; prove non-tutorial-coupling via `TutorialGuideFlowRegistry.js:699-709` before touching either. Tutorial rework is S5, a separate slice.

- **R2 — Reveal-at-spawn (fog regression).** Camps are always fully visible (`getClientEncounter` intel all-true). A pre-placed city under vision must be `hidden` in the projection until discovered. *Contain:* S3 gates visibility in the client DTO; S4's live-verify explicitly checks an undiscovered city is absent from the client map.

  **§6-R2 定论(2026-07-07,穿雾修复落地)。** 可见性分两档,刻意不同:**野怪(hostile encounter)=真单位,只在当前视野内投影**——占领城市(半径 `START_REVEAL_RADIUS`)+ 在外行军队伍(半径 `EXPLORE_REVEAL_RADIUS`,active 或 engaged/inBattle 驻敌格)实时并集,走开即隐、靠近再现,不依赖 tiles 历史(solid-fill/AI 污染对它天然无效);**城=发现常驻**——揭开过就一直显示。SSOT 落点:揭示谓词/坐标 key/客户端可画坐标集 = `WorldMapService.isTileRevealed / getTileCoordinateKey / getRevealedTileCoordSet`(城门 `filterDiscoveredNeutralCities` 与地图投影共用,防再分叉);当前视野集 = `worldExplorer/WorldExplorerVision.computeCurrentVisionCoordSet`(野怪门 `WorldCombatEncounterService.getClientState` 消费)。已知城侧残留:solid-fill 桥接格 `visible:true` 合法在已揭集内,填充格上的共享中立城仍会现形——如需根治属城侧语义切片,别顺手混入野怪门。

- **R3 — Wrong anchor (per-player layout drift).** `planCamps` keys off the player's capital (which spawns on a ring, ≠ world origin — the garrison-②a trap). A shared city layer keyed off any one capital shifts per player. *Contain:* S2 keys `planCities` off a fixed **world anchor/seed**; reserve against `player_spawn_allocations` + AI capitals, not one player's territories.

- **R4 — Hand-authored derived fields (false single-source).** Authoring `garrison/capitalDistance/battleTarget` on the raw city → silently overwritten by `normalizeTerritory:148-153`, creating drift. *Contain:* §2.2/§4-4 — placement authors only position+owner+type+status+names; a test asserts the raw city has no garrison and the normalized one does.

- **R5 — Mixed-file conquest breakage.** `TerritoryMilitaryMissions`/`TerritoryStateNormalizer` interleave scout with soldier/conquest in the SAME fns (`getMissionKind`, `normalizeWarMissions`, `updateMissionReadiness`); `MilitaryPresenter.formatScoutCountdown` may be shared by conquest UI. *Contain:* split strictly by `mission.kind`; re-run conquest tests in S1; verify countdown helpers before deleting.

- **R6 — Stale persisted scout keys.** Saves carry `scoutState/scoutReports/scoutedCoordinates/worldMap.scoutTrails/warMissions[kind=scout]`; the `scoutReports` DB column read at `GameStateRepository.js:221` must tolerate legacy; `warMissions` scout entries must be filtered or they become malformed conquest missions. *Contain:* S1 adds a drop-unknown-keys normalizer + a save round-trip test; architecture-smoke `git diff --check` is the gate.

- **R7 — Terrain algorithm drift / freeze.** Water-family terrain is RECOMPUTED from seed on every load (`WorldMapTiles.js:88/261`, `WorldMapAuthorityRepository.js:58`); a `chooseOceanTemplates/getRiverPorts` change silently re-rolls every coastline. Also `SpawnScoring.chooseTerrain:37` + `canPlaceSiteOnTerrain:350` share the generator — a distribution change shifts spawn/city validity. *Contain:* keep `chooseTerrain` byte-identical during #53; treat the true freeze (S6) as optional and out of scope; if S6 runs, snapshot into `global_world_tiles` and stop recompute.

- **R8 — Non-idempotent seeding / write-amplification.** `normalizeCombatState`/`normalizeTerritoryState` re-run on init/load/tick AND the read-only client projection path; a non-idempotent city seeder duplicates the shared set and write-amplifies shared rows. *Contain:* `ensureCitiesSeeded` id-keyed `hasAny` short-circuit (mirror `seedCampEncounters:213`); a test runs normalize N× and asserts a stable city count.

- **R-guard — Discovery vs ownership conflation.** The `:130-132` occupy guard exists because occupied/AI territories share coords with planned sites; naively removing it risks binding a foe/AI city as the player's own. *Contain:* S4 separates discovery (visible + `status:'discovered'`) from ownership; `bindSiteToTile` visibility option reflects NOT-owned for neutral/enemy.

- **R-fog — Transient-only discovery.** If backend flips `tile.siteId/status` but records no `'city'` vision source, the bitecs `FogRevealModel` (recomputes reveal per frame from sources + tiles) treats the city as only transiently lit by the decaying passing-unit source. *Contain:* S4 records a persistent `'city'` source via `recordSource:87`; S4 live-verify checks the city stays revealed after the army leaves.

- **R-radius — Square reveal vs wrapped distance.** `getRevealArea` is Chebyshev (square) while discovery/distance elsewhere uses `getWrappedDistance` (wrapped); mixing near the 1024×1024 world seam reveals/skips edge tiles inconsistently. *Contain:* S4 uses canonical/wrapped tile ids (`getCanonicalTileId`) consistently in the discovery test; add a seam-adjacent city case.

- **R-idem — Double-discovery re-firing the tutorial grant.** `advanceExploreMissions` runs on every tick + action write; a generic discovery pass without a `status`-already-`discovered` guard re-pushes territories and re-fires the tutorial grant (grant guard `:142` is the model). *Contain:* S4 guards on status/site-bound; S0 characterization test runs the tick twice and asserts one discovery.

- **R-tutorial-convergence — Stranded at `scoutExploreStarted`.** `advanceTutorialAfterGuidedExplore` is deliberately convergent (re-fires each tick to survive a lost-revision race, comment `:243-246`); `manualAdvance` is monotonic. A new vision trigger must preserve self-heal, and the pre-placed city must not be revealed *before* `scoutExploreStarted` (that advance is a no-op). *Contain:* S5 keeps the convergent re-fire; live-verify includes a reload-mid-march case.

- **R-403 — Empty-formation march.** `startWorldMarch` 403 `TUTORIAL_BLOCKED` when scout not in slot 1 is BY DESIGN (`validateScoutExploreAction`/`validateTutorialFormation`). If S5 loosens the scout-person requirement, the empty-formation (0-soldier) block must still hold. *Contain:* S5 re-verifies `hasTutorialScoutFormation`/empty-formation gate after loosening; a test asserts a 0-soldier march still 403s.

- **R-route — Player marches away from the pre-placed city.** Route truncation currently forces the march to STOP at the invented city; with a pre-placed city the player picks the target. *Contain:* S5 wires the `scout-select-world-target` guide (`FlowRegistry:669-681`) to the pre-placed city's tile; live-verify confirms the highlight points there.

- **R-grant-timing — Grant set earlier than a step gate expects.** `shouldGuaranteeTutorialEmptyCity` currently keys on the grant's ABSENCE (`RoutePlanner:254`). Setting `firstExploreEmptyCity` at init changes when it exists. *Contain:* S5 deletes `shouldGuaranteeTutorialEmptyCity` (the invent engine) so no gate reads absence; audit all 6+ grant consumers for absence-assumptions.

- **R-wrong-server (playtest) — The +4 step-shift trap.** Playtesting prod (foreign build) shifts step labels +4 and breaks the barracks chain (memory: `playtest-refactor-server-target`). *Contain:* every S5 playtest targets the **refactor** deploy; wrong-server signature = step names don't match actions / no barracks chain.

---

## Anchor index (verified this pass)

- `WorldExplorerProgression.js:100-163` — coord→territory lookups + `materializePlannedSitesForStep` + the `:130-132` occupy guard (verified).
- `WorldExplorerProgression.js:201-253` — `revealStep` vision hook + convergent tutorial advance (verified).
- `WorldCampSpawner.js:1-117` — `planCamps` pure ring-walk + gates (verified).
- `WorldExplorerRoutePlanner.js:246-334` — invent-city engine (`shouldGuaranteeTutorialEmptyCity`/`createTutorialEmptyCitySite`/`createTutorialPlannedSites`) (verified).
- `WorldExplorerActions.js:216-240` — `createTutorialPlannedSites` call + route-truncation-to-invented-city (verified).
- `GameStateRepository.js:478-521` — `getSharedWorldTerritories`/`getSharedTerritoryOwner`/`saveSharedWorldTerritories`: **only player-owned cities persisted today** (the §3.2 gap, verified).
- `GameStateRepository.js:218-238` — hydrate + `getClientProjectionForPlayer` + legacy `scoutReports` column (verified).
- `GameStateNormalizer.js:86/134/163-167` — the three seed/normalize call-sites (create/load/tick) (verified).
