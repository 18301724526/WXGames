const FamousPersonService = require('../FamousPersonService');
const { normalizeTutorialState, nowIso } = require('./TutorialState');
const {
  SCOUT_FAMOUS_GRANT_KEY,
  FIRST_ARMY_GRANT_KEY,
} = require('./TutorialSelectors');

// Grant cores for claimable tutorial task rewards (TaskRewardClaimer). The old
// idempotent ensure-* hooks (normalize-time grants) are retired: every grant is
// paid out exactly once through the task-center claim pipeline.

// Pre-place the tutorial first empty city AT GRANT TIME and record its grant identity
// (march-discovery refactor S5; docs/design/10 §3.3/§4-6). The city is chosen deterministically near the
// player's explore origin and carried INSIDE the grant (not pushed into gameState.territories), so it
// stays hidden until the guided march's vision discovers it (§6-R2). Setting the grant here — when the
// scout officer is granted, before scoutExploreStarted — makes tutorial.grants.firstExploreEmptyCity the
// single-source first-city identity from the moment the scout segment begins. Idempotent: the grant is
// only written once. Lazy requires keep the tutorial module free of the world-explorer/territory chain
// at load time (and break any require cycle).
function grantTutorialFirstCity(gameState) {
  const { TUTORIAL_FIRST_SITE_GRANT_KEY } = require('../worldExplorer/WorldExplorerShared');
  const tutorial = normalizeTutorialState(gameState.tutorial);
  if (tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY]) return tutorial;
  const WorldExplorerTutorialCity = require('../worldExplorer/WorldExplorerTutorialCity');
  const planned = WorldExplorerTutorialCity.planTutorialFirstCityGrant(gameState);
  if (!planned) return tutorial;
  const nextTutorial = {
    ...tutorial,
    grants: {
      ...(tutorial.grants || {}),
      [planned.key]: planned.grant,
    },
    updatedAt: nowIso(),
  };
  gameState.tutorial = nextTutorial;
  return nextTutorial;
}

// Grants the tutorial scout famous person and records the tutorial grant
// bookkeeping. Idempotent: an existing tutorial scout person is returned
// without creating a duplicate, and the grant record is only written once.
function grantScoutFamousPerson(gameState) {
  if (!gameState || typeof gameState !== 'object') return null;
  const grant = FamousPersonService.grantTutorialScoutFamousPerson(gameState);
  if (!grant?.person) return null;
  const tutorial = normalizeTutorialState(gameState.tutorial);
  if (!tutorial.grants?.[SCOUT_FAMOUS_GRANT_KEY]) {
    gameState.tutorial = {
      ...tutorial,
      grants: {
        ...(tutorial.grants || {}),
        [SCOUT_FAMOUS_GRANT_KEY]: {
          personId: grant.person.id,
          grantedAt: grant.grantedAt,
        },
      },
      updatedAt: nowIso(),
    };
  }
  // Pre-place the tutorial first city + set its grant at the same claim (§3.3): the scout officer and
  // the first-city target are granted together so the whole guided-explore segment has its single-source
  // target from the start.
  grantTutorialFirstCity(gameState);
  return grant;
}

// Records the first-army grant BEFORE the soldier write so the reserve floor in
// MilitaryService.normalizeMilitaryState is already active when the granted
// soldiers are normalized (barracks L1 cap would otherwise clamp them away).
function recordFirstArmyGrant(gameState, soldiers) {
  if (!gameState || typeof gameState !== 'object') return null;
  const amount = Math.max(0, Math.floor(Number(soldiers) || 0));
  if (!amount) return null;
  const tutorial = normalizeTutorialState(gameState.tutorial);
  const existing = tutorial.grants?.[FIRST_ARMY_GRANT_KEY];
  if (existing) return existing;
  const grant = { soldiers: amount, grantedAt: nowIso() };
  gameState.tutorial = {
    ...tutorial,
    grants: {
      ...(tutorial.grants || {}),
      [FIRST_ARMY_GRANT_KEY]: grant,
    },
    updatedAt: nowIso(),
  };
  return grant;
}

module.exports = {
  grantScoutFamousPerson,
  grantTutorialFirstCity,
  recordFirstArmyGrant,
};
