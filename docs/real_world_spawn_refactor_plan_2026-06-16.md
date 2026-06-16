# Real World Spawn Refactor Plan - 2026-06-16

## Goal

Move player birth logic to a production-style real world spawn flow:

- Every account is born on the authoritative world map.
- Spawn allocation avoids crowded, occupied, blocked, or tutorial-hostile areas.
- Tutorial targets are chosen around the allocated spawn and must remain operable.
- Reset releases the player's owned world state and then uses the same spawn allocation contract.
- Each implementation step has one narrow test target before the next step begins.

## Original Violation And Current Branch State

Original problem confirmed before this sequence:

- `GameStateNormalizer.createInitialGameState(playerId)` does not use `playerId` to choose a world location.
- `TerritoryInitialState.createCapital()` always creates `capital` at `(0,0)`.
- `WorldMapService.createInitialWorldMap()` always reveals around `(0,0)` and stores `origin: { q: 0, r: 0 }`.
- Production data confirms all current players share capital `(0,0)` and world origin `(0,0)`.

This means tutorial exploration and first city conquest naturally collide across accounts.

## Latest Evidence Snapshot

- Latest in-app-browser public-H5 reachability proof:
  `tmp/verification/iab-public-h5-user-demand/2026-06-16T03-37-58-389Z/`
- Latest reset-spawn public-H5 proof after the user requested explicit test evidence:
  `tmp/verification/user-demand-reset-spawn-visible/2026-06-16T03-38-18-163Z/`
- Latest post-reset tutorial completion continuation proof:
  `tmp/verification/user-demand-post-reset-tutorial-complete/2026-06-16T03-40-21-226Z/`
- Latest read-only legacy-account spawn audit:
  - host DB: `/opt/wxgame-workspace/backend/civilization.db`
  - checked at: `2026-06-16T03:49:39.259Z`
  - players/game states: `37` / `37`
  - spawn allocation rows: `3`
  - origin/capital both `(0,0)`: `34`
  - missing spawn allocation: `34`
- Latest reset-spawn public-H5 proof:
  `tmp/verification/online-reset-spawn-visible-fixed-codexqa/2026-06-16T03-15-12-038Z/`
- Latest post-reset tutorial closure public-H5 proof:
  `tmp/verification/online-post-reset-tutorial-smoke/2026-06-16T03-20-54-068Z/`
- Current manual target:
  - Treat the repeated `codexqa` reset/tutorial path as sufficiently covered until spawn/reset product code changes.
  - Legacy-account repair contract is now defined below.
  - Read-only repair planner is now implemented.
  - `test2` single-account explicit canary repair has passed public-H5 proof.
  - Next implementation step should not batch repair automatically; decide between one more canary or a guarded batch command.
- Still outside current proof:
  - migration/repair of older live accounts born at `(0,0)`
  - broad all-edge-case spawn exhaustion or high-density load coverage

Current branch state after Steps 1-5:

- Spawn allocation is now a focused backend domain under `backend/services/spawn/`.
- `GameStateNormalizer.createInitialGameState()` accepts `spawn` / `spawnAssignment` and can place the capital, world origin, and starting reveal area around that assignment.
- `SpawnAuthorityRepository` persists spawn reservations, and `GameStateRepository` exposes thin spawn delegation methods.
- Login and reset routes can create states through `SpawnLifecycleService` when that service is provided by the server composition.
- Reset allocation avoids the previous spawn and the current player's still-owned city coordinates before releasing them.
- Tutorial first-city planning has backend contract coverage for avoiding shared occupied coordinates and not materializing over shared projected coordinates.

Current evidence limits:

- User-requested public browser retest on 2026-06-16:
  - in-app browser screenshot:
    `tmp/verification/iab-public-h5-user-demand/2026-06-16T03-37-58-389Z/public-h5-visible.png`
  - reset-spawn retest:
    `tmp/verification/user-demand-reset-spawn-visible/2026-06-16T03-38-18-163Z/`
    proved `codexqa` moved from `tile_-8_-25` to `tile_23_18`, kept `25` starting visible tiles, retained only `capital`, and had no HTTP/page failures.
  - post-reset tutorial retest:
    `tmp/verification/user-demand-post-reset-tutorial/2026-06-16T03-39-18-835Z/`
    intentionally stopped at `finalStep = 16` because of `PLAYTEST_MAX_ACTIONS=20`.
  - continuation:
    `tmp/verification/user-demand-post-reset-tutorial-complete/2026-06-16T03-40-21-226Z/`
    reached `stopReason = tutorial-completed`, `finalStep = 36`, `tutorialCompleted = true`, with no visual, verification, request, response, or page failures.
- Read-only legacy-account audit on 2026-06-16:
  - Host database: `/opt/wxgame-workspace/backend/civilization.db`.
  - Access mode: readonly only; no data writes were performed.
  - Result: of `37` saved players, `34` still have `worldMap.origin = (0,0)`, capital at `(0,0)`, and no row in `player_spawn_allocations`.
  - New-flow examples:
    - `test1` at `(-6,28)`
    - `codexqa` at `(23,18)`
    - `test3` at `(26,-13)`
  - Legacy example:
    - `test2` still at `(0,0)` and has no spawn allocation.
  - Implication: future reset/new-account flow is proven for the tested QA path, but legacy account migration/repair remains open.
- Public-H5 reset walkthrough evidence exists for one completed-tutorial account:
  `tmp/verification/online-reset-spawn-visible-fixed-codexqa/2026-06-16T03-15-12-038Z/`.
  That run proves camera/render context contains the new capital, starting visibility is 25 tiles, and `site_30_11` was released for `codexqa`.
- Any migration/repair of already-existing live accounts that were born at the old `(0,0)` origin.
- A broad guarantee that every possible live-world spawn edge case is fixed; current evidence is the focused contract test set listed below.

## Legacy Account Repair Contract

This contract covers accounts confirmed by the read-only audit:

- no row in `player_spawn_allocations`
- `game_states.worldMap.origin = (0,0)`
- capital territory coordinate `(0,0)`

### Policy

- Player-triggered reset remains the clean authoritative path:
  - release the player's owned shared-world territories
  - clear that player's world visibility
  - allocate a new spawn through `SpawnLifecycleService.resetInitialStateForPlayer()`
  - create a fresh state at the new capital with 5x5 starting visibility
- Legacy repair is not allowed to run silently during login in the first implementation.
- Legacy repair is an operator action with dry-run first, explicit confirmation for writes, and one-account canary before any batch repair.
- Moving a progressed account without reset is out of scope for this sequence.
  - A non-reset move would need to rewrite city coordinates, owned territories, active/idle march routes, visible tiles, tutorial target state, task state, and UI camera state as one audited migration.
  - Until that larger migration exists, the only write-mode repair is "reset-style repair": the old invalid `(0,0)` account state is replaced by a fresh spawn state.
- Completed/tutorial-progress accounts are not automatically moved.
  - They can be repaired only by explicit operator canary/batch command, with the destructive reset-style boundary documented in the command output.
  - Future production UX can expose this as "account reset / realm relocation" rather than silent migration.

### First Implementation Step

Add a read-only planner command, not a writer:

```bash
node scripts/plan-legacy-spawn-repair.js --db /opt/wxgame-workspace/backend/civilization.db --json
```

Required output:

- total players and game states
- count of legacy `(0,0)` accounts
- count of accounts that already have spawn allocations
- sample legacy accounts sorted by last activity
- proposed repair mode per account:
  - `eligible-reset-style-repair`
  - `skip-already-spawned`
  - `skip-non-legacy`
  - `manual-review`
- zero writes and no dependency on a local temporary web server

Automated test target:

```bash
node --test backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js
node --check scripts/plan-legacy-spawn-repair.js
```

Manual/operator test target:

- Run the planner against the development server database in readonly mode.
- Pass if it reports the known audit shape from Step 23:
  - `37` players / `37` game states
  - `34` legacy `(0,0)` accounts
  - `3` existing spawn allocation rows
  - no database writes

### First Write Step After Planner

Only after the planner is committed and pushed:

- add a single-account repair command with explicit confirmation
- default target account for canary: `test2`
- write mode must require both:
  - explicit player id
  - explicit confirmation environment variable or flag
- write mode must use the same spawn lifecycle/reset authority as player reset, not custom coordinate patching
- write mode must record before/after origin, capital, spawn allocation, visible tile count, and released old owned territories

Manual public-H5 canary target after the write step:

- Open only `http://47.116.32.216/wxgame/`.
- Login to the repaired canary account.
- Pass only this slice:
  - canvas opens around the new capital, not `(0,0)`
  - starting visibility is 25 tiles
  - account has exactly the expected fresh reset-style state
  - no old `(0,0)` owned territory remains for that account

### Non-Goals For Legacy Repair

- No silent login-time rewrite.
- No batch write before a single-account public-H5 canary passes.
- No progressive coordinate relocation of completed accounts in this sequence.
- No local temporary server as user-facing proof.

## Read-Only Planner Implementation Evidence

- Added:
  - `scripts/plan-legacy-spawn-repair.js`
  - `scripts/plan-legacy-spawn-repair.test.js`
- Planner properties:
  - readonly SQLite open
  - no reset/save calls
  - `readonly: true`
  - `writesPerformed: false`
  - account repair modes:
    - `eligible-reset-style-repair`
    - `skip-already-spawned`
    - `skip-non-legacy`
    - `manual-review`
- Local verification:
  ```bash
  node --check scripts/plan-legacy-spawn-repair.js
  node --test scripts/plan-legacy-spawn-repair.test.js backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js
  git diff --check
  ```
  - Result: `35` tests passed.
- Development server readonly verification:
  - DB: `/opt/wxgame-workspace/backend/civilization.db`
  - Result:
    - `37` players
    - `37` game states
    - `3` spawn allocation rows
    - `34` `eligible-reset-style-repair`
    - `3` `skip-already-spawned`
    - `0` `manual-review`
    - `writesPerformed = false`
- Boundary:
  - This step has no player-visible browser behavior.
  - The next player-visible proof belongs to the future single-account canary write step and must use public H5.

## Single-Account Canary Repair Evidence

- Added and pushed:
  - `scripts/repair-legacy-spawn-account.js`
  - `scripts/repair-legacy-spawn-account.test.js`
  - commit: `eea6037e feat add legacy spawn canary repair command`
- Local verification:
  ```bash
  node --check scripts/repair-legacy-spawn-account.js
  node --test scripts/plan-legacy-spawn-repair.test.js scripts/repair-legacy-spawn-account.test.js backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js
  git diff --check
  ```
  - Result: `41` tests passed.
- Server safety checks before write:
  - `test2` dry-run reported `eligible-reset-style-repair` and `writesPerformed = false`.
  - write without exact confirmation was rejected.
- Confirmed write:
  - Command included `--player test2 --write --confirm repair-legacy-spawn:test2`.
  - Before origin/capital: `(0,0)`.
  - After origin/capital: `(-12,-25)`.
  - After spawn allocation: `-12,-25`.
  - After visible tile count: `25`.
  - Canonical `test2` territories: `capital` only.
- Planner after canary:
  - spawn allocations: `4`
  - remaining legacy origin/capital `(0,0)`: `33`
  - eligible reset-style repairs: `33`
  - already spawned: `4`
- Public-H5 proof:
  - `tmp/verification/test2-canary-public-h5-playwright-fixed/2026-06-16T04-11-35-028Z/`
  - screenshot: `test2-canary-public-h5.png`
  - summary: `summary.json`
  - API and frontend both reported:
    - player `test2`
    - origin/capital `tile_-12_-25`
    - visible tile count `25`
    - local owned territories `capital` only
    - render contains capital
    - capital hit target visible
    - no bad responses, request failures, or page errors
- User-demanded QA follow-up:
  - In-app Browser screenshot:
    `tmp/verification/user-demand-public-h5-test2-qa/2026-06-16T12-20-00-codex/iab-current-public-h5.png`
  - A reset-flow script was tried and failed at `wait-02-request-reset`; this is recorded as a bad test target, not a pass.
  - Final readonly public-H5 proof:
    `tmp/verification/user-demand-public-h5-test2-readonly-iab-auth/2026-06-16T04-24-27-720Z/`
  - Final readonly proof used `codexIabToken/codexIabUser` URL auth, performed no reset/settings clicks, and passed:
    - player `test2`
    - API and frontend origin/capital `tile_-12_-25`
    - API and frontend visible tile count `25`
    - current-player owned territories `capital` only
    - shared occupied projection `site_25_20` belongs to `codexqa`
    - render contains capital and capital hit target visible
    - no HTTP failures, request failures, or page errors
- Evidence correction:
  - The first public-H5 verifier run misclassified `site_25_20` as local-owned.
  - Readonly DB inspection showed `site_25_20` belongs to `codexqa` in shared-world projection, while `test2` canonical state contains only `capital`.
  - The fixed verifier separates shared occupied projections from current-player owned territory.
- Boundary:
  - Only `test2` was repaired.
  - No batch repair has been performed.

## Target Architecture

### Spawn Domain

Create a dedicated `backend/services/spawn/` domain. It owns:

- candidate generation
- occupancy and crowding scoring
- terrain and tutorial operability checks
- deterministic tie breaking
- spawn decision metadata

It must not own:

- HTTP routes
- player authentication
- SQLite table creation
- tutorial progression side effects
- frontend DTO assembly

### Repository Boundary

`GameStateRepository` should eventually provide a small authority API:

- read currently occupied capital and territory coordinates
- reserve or assign one spawn atomically
- release a player's spawn on reset when design requires it

The repository may persist spawn records, but it should not contain scoring rules.

### Initial State Boundary

`GameStateNormalizer.createInitialGameState()` should eventually accept a spawn assignment:

- capital coordinate
- world origin
- initial reveal center
- spawn metadata

It should not choose the spawn by itself.

### Tutorial Boundary

Tutorial first-city planning should remain route/territory aware:

- use the player's real spawn as origin
- exclude shared occupied coordinates
- avoid water/blocked terrain
- re-plan if the original target becomes unavailable before materialization

## Step Plan

### Step 1 - Spawn Scoring Core

Add a small, pure spawn allocation core with tests. No route, DB, login, reset, or frontend behavior changes.

Test target:

```bash
node --test backend/tests/SpawnAllocator.test.js
```

Manual test target:

- No in-game behavior change expected.
- Confirm the pushed branch only adds the plan and pure allocator test coverage.

### Step 2 - Repository Spawn Authority

Add the persistence boundary and atomic reservation API.

Status:

- Added `SpawnAuthorityRepository` as the focused SQLite authority for spawn reservations.
- `GameStateRepository` only exposes thin delegation methods.
- At this step, login, reset, initial state, and tutorial behavior were not wired to the new table yet. Later steps now cover the initial-state, login/reset, and tutorial-planning integration.

Test target:

```bash
node --test backend/tests/GameStateRepository.test.js backend/tests/SpawnAllocator.test.js
```

Manual test target:

- On a staging or backup DB, create two new accounts concurrently.
- Confirm their reserved spawn coordinates differ and both reservations survive reload.

### Step 3 - Spawn-Aware Initial State

Allow initial state creation to receive a spawn assignment and place:

- capital territory
- active city
- world origin
- initial reveal tiles
- capital tile binding

Status:

- `GameStateNormalizer.createInitialGameState()` accepts an optional `spawn` / `spawnAssignment`.
- `TerritoryInitialState` and `WorldMapService` can create the capital, origin, and starting reveal area around that assignment.
- Calling without a spawn assignment still preserves the legacy `(0,0)` fallback for direct tests and defensive compatibility; login/reset integration is now wired through Step 4.

Test target:

```bash
node --test backend/tests/GameStateServiceSplit.test.js backend/tests/WorldMapArchitecture.test.js backend/tests/SpawnAllocator.test.js
```

Manual test target:

- Login two fresh whitelist accounts.
- Confirm their capital coordinates and visible starting regions differ.

### Step 4 - Login And Reset Integration

Wire allocation into first login and reset.

Status:

- `SpawnLifecycleService` owns first-login and reset spawn allocation.
- First login reuses an existing reservation when present, otherwise allocates and reserves a valid real-world spawn.
- Reset allocates a fresh spawn, avoids the player's previous spawn and other occupied/reserved coordinates, then clears the player's old save/shared ownership through the existing reset path.
- `AuthService` remains callback-driven; spawn/world rules stay outside auth.

Reset semantics for this project:

- release only territories owned by the resetting player
- clear player visibility, missions, tutorial state, and canonical save
- allocate a fresh valid spawn unless product design later chooses "keep spawn if still valid"
- never delete another player's shared world territory

Test target:

```bash
node --test backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js backend/tests/GameStateProjectionArchitecture.test.js backend/tests/SpawnAllocator.test.js
```

Latest verification:

- Command rerun on 2026-06-16:
  `node --test backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js backend/tests/GameStateProjectionArchitecture.test.js backend/tests/SpawnAllocator.test.js`
- Result: 49 tests passed.
- Covered contracts include login route spawn-lifecycle creation, reset route spawn-lifecycle creation, reset player visibility replacement, persisted 25-tile starting visibility, occupied/reserved coordinate avoidance, and default capital spacing greater than 20 tiles.
- Public-H5 visible reset proof was added on 2026-06-16:
  `npm.cmd run playtest:online-reset-spawn`
- Evidence directory:
  `tmp/verification/online-reset-spawn-visible-fixed-codexqa/2026-06-16T03-15-12-038Z/`
- Account used: `codexqa / 123456`.
- Before reset:
  - origin/capital `tile_28_9`
  - owned territories: `capital`, `site_30_11`
- After reset:
  - origin/capital `tile_-8_-25`
  - visible starting tiles: `25`
  - owned territories: `capital` only
  - render context contains the new capital
  - new capital has a visible canvas hit target
  - bad HTTP responses, request failures, and page errors were all `0`
- Verdict: pass. The previous `site_30_11` ownership was released for `codexqa`.
- Calibration note:
  - A `test3` run at `tmp/verification/online-reset-spawn-visible-fixed/2026-06-16T03-11-23-935Z/` did not reach the reset button because `test3` had already been reset to tutorial step `0`, and the tutorial shield correctly blocked non-highlighted settings input. That run is verifier/account-state evidence, not a spawn/reset product failure.
- Post-reset tutorial closure proof:
  - Command: `PLAYTEST_RESET_ACCOUNT=0 npm.cmd run playtest:online-tutorial`
  - Evidence path: `tmp/verification/online-post-reset-tutorial-smoke/2026-06-16T03-20-54-068Z/`
  - Starting state used the Step 19 post-reset capital at `-8,-25`.
  - Result: `stopReason = tutorial-completed`, `finalStep = 36`, `tutorialCompleted = true`, `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`, `visualFindings = 0`.
  - This proves the tested post-reset spawn/camera state did not deadlock the guided tutorial path.

Manual test target:

- Account A finishes tutorial and occupies first city.
- Reset A.
- Confirm A's old occupied shared territory is released.
- Confirm A's new spawn and first tutorial target are not on another occupied coordinate.

### Step 4.1 - Reset Camera Follows Spawn

Status:

- Account reset applies the server reset state before moving the world camera.
- The world camera reset control returns to the current capital spawn, not raw pan `(0,0)`.
- World tile-map and runtime bake signatures include `worldMap.origin`, so a changed spawn cannot reuse an old map cache.

Test target:

```bash
node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/auth.test.js frontend/js/state/UIStatePresenter.test.js frontend/js/platform/WorldMapRuntime.test.js
npm run test -- frontend
npm run test:architecture
```

Manual test target:

- Reset Account A after it has a non-origin spawn.
- Confirm the first rendered world map view is centered around A's new capital.
- Tap the world-map reset camera control and confirm the view returns to A's new capital instead of `(0,0)`.

### Step 5 - Tutorial Replanning Hardening

Make the guided first-city route re-plan when the chosen target becomes occupied before materialization.

Status:

- Existing backend contracts already cover projection-aware tutorial replanning and materialization guards for the guided first-city path.
- `GameRoutesTutorial.test.js` proves the guided first-city march uses shared world projection when planning: if the old guided coordinate is occupied, the mission target moves to another reachable coordinate.
- `WorldExplorerArchitecture.test.js` proves the route planner excludes shared occupied coordinates for tutorial planned sites and progression does not materialize planned tutorial sites over shared projected coordinates.
- No product code change was made in this evidence step.

Test target:

```bash
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameRoutesTutorial.test.js
```

Latest verification:

- Command rerun on 2026-06-16:
  `node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameRoutesTutorial.test.js`
- Result: 33 tests passed.

Manual test target:

- Put another player-owned city on the old guided target.
- Start tutorial exploration.
- Confirm the guide chooses another reachable neutral target.

## Non-Goals For This Sequence

- No frontend redesign.
- No local production-data rewrite during code review.
- No migration of existing live accounts until the new flow is tested on staging.
- No large "god service" that mixes auth, world-map, tutorial, repository, and spawn scoring.
