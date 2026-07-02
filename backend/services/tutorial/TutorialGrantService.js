const FamousPersonService = require('../FamousPersonService');
const { normalizeTutorialState, nowIso } = require('./TutorialState');
const {
  SCOUT_FAMOUS_GRANT_KEY,
  FIRST_ARMY_GRANT_KEY,
} = require('./TutorialSelectors');

// Grant cores for claimable tutorial task rewards (TaskRewardClaimer). The old
// idempotent ensure-* hooks (normalize-time grants) are retired: every grant is
// paid out exactly once through the task-center claim pipeline.

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
  recordFirstArmyGrant,
};
