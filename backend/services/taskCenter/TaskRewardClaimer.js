const CityService = require('../CityService');
const FamousPersonService = require('../FamousPersonService');
const MilitaryService = require('../MilitaryService');
const TaskDefinitionService = require('../TaskDefinitionService');
const TutorialGrantService = require('../tutorial/TutorialGrantService');
const TaskRewardGrantLedger = require('./TaskRewardGrantLedger');

function addResources(target, source = {}) {
  Object.entries(source || {}).forEach(([key, value]) => {
    const amount = Number(value) || 0;
    if (amount > 0) {
      target[key] = Math.round(((Number(target[key]) || 0) + amount) * 1000) / 1000;
    }
  });
  return target;
}

// Soldier rewards land in the active city military, not in city resources.
// Mechanics mirror the EventService {type:'soldiers'} effect: normalize with a
// city-scoped context, then refresh derived city stats. The first-army task
// grant is recorded BEFORE the normalize so the reserve floor is already active
// and the barracks cap cannot clamp the grant away in this same mutation.
function applySoldierReward(gameState, city, soldiers) {
  const amount = Math.max(0, Math.floor(Number(soldiers) || 0));
  if (!amount) return;
  TaskRewardGrantLedger.recordSoldierGrant(
    gameState,
    TaskRewardGrantLedger.FIRST_ARMY_GRANT_KEY,
    { soldiers: amount },
  );
  const current = Number(city.military?.soldiers) || 0;
  city.military = MilitaryService.normalizeMilitaryState(
    {
      ...(city.military || {}),
      soldiers: Math.max(0, current + amount),
    },
    { ...gameState, activeCityId: city.id, buildings: city.buildings, military: city.military },
  );
  CityService.applyDerivedStatsToCity(city, gameState);
}

// Famous-person rewards grant the tutorial scout (the only supported archetype;
// TaskDefinitionNormalizer validates the config side).
function applyFamousPersonReward(gameState, archetype) {
  if (archetype !== 'scout')
    return { success: false, error: `UNKNOWN_FAMOUS_PERSON_REWARD:${archetype}` };
  const grant = FamousPersonService.grantTutorialScoutFamousPerson(gameState);
  if (!grant?.person) return { success: false, error: 'FAMOUS_PERSON_GRANT_FAILED' };
  const record = TaskRewardGrantLedger.recordFamousPersonGrant(
    gameState,
    TaskRewardGrantLedger.SCOUT_FAMOUS_GRANT_KEY,
    { personId: grant.person.id, grantedAt: grant.grantedAt },
  );
  if (!record) return { success: false, error: 'FAMOUS_PERSON_GRANT_RECORD_FAILED' };
  // Keep the legacy guided first-city anchor until the backend tutorial service is removed in B3'.
  TutorialGrantService.grantTutorialFirstCity(gameState);
  return { success: true };
}

function applyTaskReward(gameState, reward = {}) {
  CityService.normalizeCities(gameState);
  const city = CityService.getActiveCity(gameState);
  const hasResolvedResources = reward.resources && Object.keys(reward.resources).length > 0;
  const resolved = hasResolvedResources
    ? { resources: reward.resources, errors: [] }
    : TaskDefinitionService.resolveRewardResources(reward);
  if (resolved.errors?.length) return { success: false, errors: resolved.errors, resources: {} };
  if (reward.famousPerson) {
    const famous = applyFamousPersonReward(gameState, reward.famousPerson);
    if (!famous.success) return { success: false, errors: [famous.error], resources: {} };
  }
  const { soldiers, ...cityResources } = resolved.resources || {};
  city.resources = addResources(city.resources || {}, cityResources);
  applySoldierReward(gameState, city, soldiers);
  return { success: true, errors: [], resources: resolved.resources };
}

function buildRewardReveal(task, resources) {
  return {
    title: '任务奖励',
    subtitle: task.title,
    rewardText: task.rewardText,
    resources,
    createdAt: Date.now(),
  };
}

module.exports = {
  addResources,
  applyTaskReward,
  buildRewardReveal,
};
