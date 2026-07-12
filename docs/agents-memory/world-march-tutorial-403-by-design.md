---
name: world-march-tutorial-403-by-design
description: "World-march HTTP 403 during the tutorial = TUTORIAL_BLOCKED formation gate (scout must be in formation slot 1), working as designed — NOT a de-shell/persistence regression."
metadata: 
  node_type: memory
  type: reference
  originSessionId: a4c6f5cf-d730-48f3-aa71-7fc073e953fe
---

Symptom: `POST /game/action {action:'startWorldMarch'}` → **HTTP 403**, body `{error:'TUTORIAL_BLOCKED', message:'Please keep the tutorial scout famous person in formation 1 before exploring.'}`. Seen on local WSL at tutorialStep 23.

**This is the tutorial formation gate working as designed, NOT a bug/regression.** The only 403 path on `/game/action` is `gameRoutes.js:268-272` turning the tutorial validator's `{allowed:false}` into 403. At step 23 (`scoutWorldPanelOpened`), `validateScoutExploreAction` (TutorialActionValidator.js:138-146) allows the march iff `hasTutorialScoutFormation(gameState, payload)` is true — i.e. the granted scout famous-person (`tutorial.grants.scoutFamousPerson.personId`) is in formation **slot 1** of the marched city. The march request omits `cityId` so the backend defaults to `gameState.activeCityId||'capital'`; `formationSlot:1`.

**Ruled out as a 刀7/persistence regression (3 proofs):** (1) read `getFormationSnapshot` (TutorialSelectors.js:36-43) and write `setArmyFormation` (MilitaryService.js:355) target the SAME shape `cities[cityId].military.formations[cityId][slot-1]` (read also checks legacy top-level `military.formations`); (2) `cities` is a JSON-blob TEXT column (GameStateRepository.js:24/185) → the formation survives save/load roundtrip; (3) existing test `backend/tests/GameRoutesTutorial.test.js` "starts guided world march" (scout in capital formation 1 → march → **200**, advances to scoutExploreStarted) passes on the de-shell branch (ran 13/13 green).

**`hasTutorialScoutFormation` returns false when:** (a) `tutorial.grants.scoutFamousPerson.personId` empty/missing (returns false BEFORE checking the formation — common on force-advanced/seeded test accounts); (b) scout not in slot 1 of the active city (moved/cleared, or activeCityId≠the city where scout sits). To diagnose a live account, read the response's `payload.gameState`: activeCityId, tutorial.grants.scoutFamousPerson, cities[activeCityId].military.formations, famousPeople(archetype:'scout').

Step 22 (`scoutFormationSaved`) only advances when the scout is in the saved formation (MilitaryService.js:373), so an honest playthrough reaching 23 HAD the scout in formation — a 403 then means it was later emptied OR the grant is missing OR an inconsistent forced state. Related: [[render-host-delegation-observability-debt]] (the createGradient site-modal crash fixed just before this, 641ee6e3), [[world-march-passability]] (ocean/route blocks are 400, not 403).
