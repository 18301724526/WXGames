# Real World Spawn Refactor Plan - 2026-06-16

## Goal

Move player birth logic to a production-style real world spawn flow:

- Every account is born on the authoritative world map.
- Spawn allocation avoids crowded, occupied, blocked, or tutorial-hostile areas.
- Tutorial targets are chosen around the allocated spawn and must remain operable.
- Reset releases the player's owned world state and then uses the same spawn allocation contract.
- Each implementation step has one narrow test target before the next step begins.

## Current Violation

The current implementation is not acceptable for a shared SLG world:

- `GameStateNormalizer.createInitialGameState(playerId)` does not use `playerId` to choose a world location.
- `TerritoryInitialState.createCapital()` always creates `capital` at `(0,0)`.
- `WorldMapService.createInitialWorldMap()` always reveals around `(0,0)` and stores `origin: { q: 0, r: 0 }`.
- Production data confirms all current players share capital `(0,0)` and world origin `(0,0)`.

This means tutorial exploration and first city conquest naturally collide across accounts.

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
- Existing login, reset, initial state, and tutorial behavior are not wired to the new table yet.

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

Test target:

```bash
node --test backend/tests/GameStateServiceSplit.test.js backend/tests/WorldMapArchitecture.test.js backend/tests/SpawnAllocator.test.js
```

Manual test target:

- Login two fresh whitelist accounts.
- Confirm their capital coordinates and visible starting regions differ.

### Step 4 - Login And Reset Integration

Wire allocation into first login and reset.

Reset semantics for this project:

- release only territories owned by the resetting player
- clear player visibility, missions, tutorial state, and canonical save
- allocate a fresh valid spawn unless product design later chooses "keep spawn if still valid"
- never delete another player's shared world territory

Test target:

```bash
node --test backend/tests/GameStateRepository.test.js backend/tests/GameStateProjectionArchitecture.test.js backend/tests/SpawnAllocator.test.js
```

Manual test target:

- Account A finishes tutorial and occupies first city.
- Reset A.
- Confirm A's old occupied shared territory is released.
- Confirm A's new spawn and first tutorial target are not on another occupied coordinate.

### Step 5 - Tutorial Replanning Hardening

Make the guided first-city route re-plan when the chosen target becomes occupied before materialization.

Test target:

```bash
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameRoutesTutorial.test.js
```

Manual test target:

- Put another player-owned city on the old guided target.
- Start tutorial exploration.
- Confirm the guide chooses another reachable neutral target.

## Non-Goals For This Sequence

- No frontend redesign.
- No local production-data rewrite during code review.
- No migration of existing live accounts until the new flow is tested on staging.
- No large "god service" that mixes auth, world-map, tutorial, repository, and spawn scoring.
