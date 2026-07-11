const WorldMapService = require('../WorldMapService');
const TaskRewardGrantLedger = require('../taskCenter/TaskRewardGrantLedger');
const { normalizeTutorialState, nowIso } = require('./TutorialState');
const {
  SCOUT_FAMOUS_GRANT_KEY,
  FIRST_ARMY_GRANT_KEY,
} = TaskRewardGrantLedger;

// Grant cores for claimable tutorial task rewards (TaskRewardClaimer). The old
// idempotent ensure-* hooks (normalize-time grants) are retired: every grant is
// paid out exactly once through the task-center claim pipeline.

// The tutorial grant references the already-materialized companion city. City creation belongs to the
// spawn/world-city pipeline; this grant only pins the guided task to that single source of truth.
function getNearestDiscoveredNeutralCity(gameState = {}) {
  const origin = gameState.worldMap?.origin || { q: 0, r: 0 };
  const cities = (Array.isArray(gameState.territories) ? gameState.territories : [])
    .filter((territory) => (
      territory
      && territory.id
      && territory.owner === 'neutral'
      && territory.status === 'discovered'
      && !territory.ownerPlayerId
    ));
  return cities.sort((a, b) => (
    WorldMapService.getWrappedDistance(origin, { q: a.x ?? a.q, r: a.y ?? a.r })
    - WorldMapService.getWrappedDistance(origin, { q: b.x ?? b.q, r: b.y ?? b.r })
    || String(a.id).localeCompare(String(b.id))
  ))[0] || null;
}

function grantTutorialFirstCity(gameState) {
  const { TUTORIAL_FIRST_SITE_GRANT_KEY } = require('../worldExplorer/WorldExplorerShared');
  const tutorial = normalizeTutorialState(gameState.tutorial);
  if (tutorial.grants?.[TUTORIAL_FIRST_SITE_GRANT_KEY]) return tutorial;
  const city = getNearestDiscoveredNeutralCity(gameState);
  if (!city) return tutorial;
  const nextTutorial = {
    ...tutorial,
    grants: {
      ...(tutorial.grants || {}),
      [TUTORIAL_FIRST_SITE_GRANT_KEY]: {
        siteId: city.id,
        x: city.x ?? city.q,
        y: city.y ?? city.r,
        plannedAt: nowIso(),
      },
    },
    updatedAt: nowIso(),
  };
  gameState.tutorial = nextTutorial;
  return nextTutorial;
}

// Compatibility shell only. The task reward pipeline owns the actual famous
// person payout and the taskRewardGrants ledger.
function grantScoutFamousPerson(gameState) {
  if (!gameState || typeof gameState !== 'object') return null;
  const grant = TaskRewardGrantLedger.getFamousPersonGrant(gameState, SCOUT_FAMOUS_GRANT_KEY);
  if (!grant?.personId) return null;
  const person = (Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
    .find((item) => String(item?.id || '') === grant.personId);
  return person ? { person: { ...person }, grantedAt: grant.grantedAt, created: false } : null;
}

// Compatibility shell only. TaskRewardClaimer writes first-army bookkeeping to
// taskRewardGrants before normalizing the soldier reward.
function recordFirstArmyGrant(gameState, soldiers) {
  if (!gameState || typeof gameState !== 'object') return null;
  const amount = Math.max(0, Math.floor(Number(soldiers) || 0));
  if (!amount) return null;
  return TaskRewardGrantLedger.recordSoldierGrant(gameState, FIRST_ARMY_GRANT_KEY, {
    soldiers: amount,
    grantedAt: nowIso(),
  });
}

module.exports = {
  grantScoutFamousPerson,
  grantTutorialFirstCity,
  recordFirstArmyGrant,
};
