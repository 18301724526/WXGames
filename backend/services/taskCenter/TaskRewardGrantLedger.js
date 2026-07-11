const SCOUT_FAMOUS_GRANT_KEY = 'scoutFamousPerson';
const FIRST_ARMY_GRANT_KEY = 'firstArmy';

function normalizeTimestamp(value) {
  const text = String(value || '').trim();
  return text || new Date().toISOString();
}

function normalizeFamousPersonGrant(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const personId = String(source.personId || '').trim();
  if (!personId) return null;
  return {
    personId,
    grantedAt: normalizeTimestamp(source.grantedAt),
  };
}

function normalizeSoldierGrant(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const soldiers = Math.max(0, Math.floor(Number(source.soldiers) || 0));
  if (!soldiers) return null;
  return {
    soldiers,
    grantedAt: normalizeTimestamp(source.grantedAt),
  };
}

function createInitialTaskRewardGrants() {
  return {
    famousPersons: {},
    soldiers: {},
  };
}

function normalizeTaskRewardGrants(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const ledger = createInitialTaskRewardGrants();
  Object.entries(source.famousPersons || {}).forEach(([key, value]) => {
    const grant = normalizeFamousPersonGrant(value);
    if (grant) ledger.famousPersons[key] = grant;
  });
  Object.entries(source.soldiers || {}).forEach(([key, value]) => {
    const grant = normalizeSoldierGrant(value);
    if (grant) ledger.soldiers[key] = grant;
  });
  return ledger;
}

function ensureTaskRewardGrants(gameState) {
  if (!gameState || typeof gameState !== 'object') return createInitialTaskRewardGrants();
  gameState.taskRewardGrants = normalizeTaskRewardGrants(gameState.taskRewardGrants);
  return gameState.taskRewardGrants;
}

function readLegacyTutorialGrant(gameState, key) {
  return gameState?.tutorial?.grants?.[key] || null;
}

function getFamousPersonGrant(gameState, key) {
  if (!gameState || typeof gameState !== 'object') return null;
  const ledger = ensureTaskRewardGrants(gameState);
  const existing = normalizeFamousPersonGrant(ledger.famousPersons[key]);
  if (existing) return existing;
  const legacy = normalizeFamousPersonGrant(readLegacyTutorialGrant(gameState, key));
  if (legacy) {
    ledger.famousPersons[key] = legacy;
    return legacy;
  }
  return null;
}

function getSoldierGrant(gameState, key) {
  if (!gameState || typeof gameState !== 'object') return null;
  const ledger = ensureTaskRewardGrants(gameState);
  const existing = normalizeSoldierGrant(ledger.soldiers[key]);
  if (existing) return existing;
  const legacy = normalizeSoldierGrant(readLegacyTutorialGrant(gameState, key));
  if (legacy) {
    ledger.soldiers[key] = legacy;
    return legacy;
  }
  return null;
}

function recordFamousPersonGrant(gameState, key, rawGrant = {}) {
  if (!gameState || typeof gameState !== 'object') return null;
  const ledger = ensureTaskRewardGrants(gameState);
  const existing = normalizeFamousPersonGrant(ledger.famousPersons[key]);
  if (existing) return existing;
  const grant = normalizeFamousPersonGrant(rawGrant);
  if (!grant) return null;
  ledger.famousPersons[key] = grant;
  return grant;
}

function recordSoldierGrant(gameState, key, rawGrant = {}) {
  if (!gameState || typeof gameState !== 'object') return null;
  const ledger = ensureTaskRewardGrants(gameState);
  const existing = normalizeSoldierGrant(ledger.soldiers[key]);
  if (existing) return existing;
  const grant = normalizeSoldierGrant(rawGrant);
  if (!grant) return null;
  ledger.soldiers[key] = grant;
  return grant;
}

module.exports = {
  SCOUT_FAMOUS_GRANT_KEY,
  FIRST_ARMY_GRANT_KEY,
  createInitialTaskRewardGrants,
  ensureTaskRewardGrants,
  getFamousPersonGrant,
  getSoldierGrant,
  normalizeTaskRewardGrants,
  recordFamousPersonGrant,
  recordSoldierGrant,
};
