const DEFAULT_FORMATION_POLICY = Object.freeze({
  perMemberSoldierCap: 1000,
  recruitmentCostPerSoldier: Object.freeze({ food: 1 }),
  soldierRefundRatio: 0.5,
});

function toInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function toRatio(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeResourceCost(cost = {}) {
  const result = {};
  Object.entries(cost && typeof cost === 'object' ? cost : {}).forEach(([key, value]) => {
    const amount = Number(value);
    if (!key || !Number.isFinite(amount) || amount <= 0) return;
    result[String(key)] = amount;
  });
  return Object.keys(result).length
    ? result
    : { ...DEFAULT_FORMATION_POLICY.recruitmentCostPerSoldier };
}

function normalizePolicy(rawPolicy = {}) {
  const cap = toInteger(
    rawPolicy.formationMemberSoldierCap
      ?? rawPolicy.perMemberSoldierCap
      ?? rawPolicy.maxSoldiersPerFormationMember,
    DEFAULT_FORMATION_POLICY.perMemberSoldierCap,
  );
  return {
    perMemberSoldierCap: cap > 0 ? cap : DEFAULT_FORMATION_POLICY.perMemberSoldierCap,
    recruitmentCostPerSoldier: normalizeResourceCost(
      rawPolicy.recruitmentCostPerSoldier
        || rawPolicy.soldierRecruitmentCostPerSoldier
        || rawPolicy.soldierCostPerRecruit,
    ),
    soldierRefundRatio: toRatio(
      rawPolicy.soldierRefundRatio
        ?? rawPolicy.formationSoldierRefundRatio
        ?? rawPolicy.refundRatio,
      DEFAULT_FORMATION_POLICY.soldierRefundRatio,
    ),
  };
}

function normalizeSoldierAssignments(assignments = {}, memberIds = [], policy = DEFAULT_FORMATION_POLICY) {
  const cap = normalizePolicy(policy).perMemberSoldierCap;
  const source = assignments && typeof assignments === 'object' ? assignments : {};
  const result = {};
  memberIds.forEach((memberId) => {
    const id = String(memberId || '').trim();
    if (!id) return;
    result[id] = Math.min(cap, toInteger(source[id], 0));
  });
  return result;
}

function sumAssignments(assignments = {}) {
  return Object.values(assignments && typeof assignments === 'object' ? assignments : {})
    .reduce((sum, value) => sum + toInteger(value, 0), 0);
}

function normalizeFormationStrength(rawFormation = {}, policy = DEFAULT_FORMATION_POLICY) {
  const memberIds = Array.isArray(rawFormation.memberIds)
    ? rawFormation.memberIds.map((id) => String(id || '').trim()).filter(Boolean)
    : [];
  const soldierAssignments = normalizeSoldierAssignments(
    rawFormation.soldierAssignments || rawFormation.memberSoldiers || {},
    memberIds,
    policy,
  );
  return {
    soldierAssignments,
    soldiersAssigned: sumAssignments(soldierAssignments),
  };
}

function validateRequestedAssignments(assignments = {}, memberIds = [], policy = DEFAULT_FORMATION_POLICY) {
  const normalizedPolicy = normalizePolicy(policy);
  const source = assignments && typeof assignments === 'object' ? assignments : {};
  const validIds = new Set(memberIds.map((id) => String(id)));
  for (const [rawId, rawValue] of Object.entries(source)) {
    const id = String(rawId || '').trim();
    if (!id || !validIds.has(id)) continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
      return { success: false, error: 'FORMATION_SOLDIER_ASSIGNMENT_INVALID', personId: id };
    }
    if (value > normalizedPolicy.perMemberSoldierCap) {
      return {
        success: false,
        error: 'FORMATION_SOLDIER_CAP_EXCEEDED',
        personId: id,
        cap: normalizedPolicy.perMemberSoldierCap,
      };
    }
  }
  return { success: true };
}

function scaleResourceCost(costPerSoldier = {}, soldiers = 0, ratio = 1, options = {}) {
  const count = toInteger(soldiers, 0);
  const multiplier = Math.max(0, Number(ratio) || 0);
  const round = options.round === 'floor' ? Math.floor : Math.ceil;
  const result = {};
  Object.entries(normalizeResourceCost(costPerSoldier)).forEach(([key, amount]) => {
    const total = round(amount * count * multiplier);
    if (total > 0) result[key] = total;
  });
  return result;
}

function hasEnoughResources(resources = {}, cost = {}) {
  return Object.entries(cost || {}).every(([key, amount]) => (
    Number(resources?.[key] ?? 0) >= Number(amount || 0)
  ));
}

function getAffordableSoldierCount(resources = {}, costPerSoldier = {}, maxSoldiers = Number.MAX_SAFE_INTEGER) {
  const max = toInteger(maxSoldiers, 0);
  const entries = Object.entries(normalizeResourceCost(costPerSoldier));
  if (!entries.length) return max;
  return entries.reduce((limit, [key, amount]) => {
    if (amount <= 0) return limit;
    return Math.min(limit, Math.floor(Number(resources?.[key] ?? 0) / amount));
  }, max);
}

function cloneAssignments(assignments = {}) {
  return Object.fromEntries(Object.entries(assignments || {}).map(([key, value]) => [key, toInteger(value, 0)]));
}

function buildFormationSnapshot(formation = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const memberIds = Array.isArray(formation.memberIds) ? formation.memberIds.map(String) : [];
  const assignments = cloneAssignments(formation.soldierAssignments || {});
  const members = memberIds.map((personId) => {
    const soldiers = toInteger(assignments[personId], 0);
    return {
      personId,
      soldiersCommitted: soldiers,
      soldiersRemaining: soldiers,
    };
  });
  const soldiersCommitted = members.reduce((sum, member) => sum + member.soldiersCommitted, 0);
  return {
    schema: 'formation-snapshot-v1',
    sourceCityId: formation.cityId || options.cityId || 'capital',
    slot: Math.max(1, Math.floor(Number(formation.slot) || 1)),
    members,
    soldiersCommitted,
    soldiersRemaining: soldiersCommitted,
    lockedAt: now.toISOString(),
    settledAt: null,
  };
}

function normalizeFormationSnapshot(rawSnapshot = null) {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;
  const members = (Array.isArray(rawSnapshot.members) ? rawSnapshot.members : [])
    .map((member) => {
      const personId = String(member?.personId || member?.id || '').trim();
      if (!personId) return null;
      const committed = toInteger(member.soldiersCommitted ?? member.soldiers ?? member.count, 0);
      return {
        personId,
        soldiersCommitted: committed,
        soldiersRemaining: Math.min(committed, toInteger(member.soldiersRemaining, committed)),
      };
    })
    .filter(Boolean);
  const soldiersCommitted = members.reduce((sum, member) => sum + member.soldiersCommitted, 0);
  const soldiersRemaining = members.reduce((sum, member) => sum + member.soldiersRemaining, 0);
  return {
    schema: 'formation-snapshot-v1',
    sourceCityId: String(rawSnapshot.sourceCityId || rawSnapshot.cityId || 'capital').trim() || 'capital',
    slot: Math.max(1, Math.floor(Number(rawSnapshot.slot) || 1)),
    members,
    soldiersCommitted,
    soldiersRemaining,
    lockedAt: rawSnapshot.lockedAt || rawSnapshot.createdAt || new Date().toISOString(),
    settledAt: rawSnapshot.settledAt || null,
  };
}

function getSnapshotAssignments(snapshot = {}) {
  const normalized = normalizeFormationSnapshot(snapshot);
  if (!normalized) return {};
  return Object.fromEntries(normalized.members.map((member) => [
    member.personId,
    toInteger(member.soldiersRemaining, 0),
  ]));
}

function isSnapshotSettled(snapshot = {}) {
  return Boolean(snapshot?.settledAt);
}

function isFormationLockedByMission(mission = {}, cityId = 'capital', slot = 1) {
  if (!mission || !['active', 'idle'].includes(mission.status)) return false;
  const formation = mission.formation || {};
  const sameFormation = String(formation.cityId || mission.formationSnapshot?.sourceCityId || 'capital') === String(cityId || 'capital')
    && Math.max(1, Math.floor(Number(formation.slot ?? mission.formationSnapshot?.slot) || 1)) === Math.max(1, Math.floor(Number(slot) || 1));
  if (!sameFormation) return false;
  if (mission.status === 'active') return true;
  return Boolean(mission.formationSnapshot && !isSnapshotSettled(mission.formationSnapshot));
}

module.exports = {
  DEFAULT_FORMATION_POLICY,
  buildFormationSnapshot,
  getAffordableSoldierCount,
  getSnapshotAssignments,
  hasEnoughResources,
  isFormationLockedByMission,
  isSnapshotSettled,
  normalizeFormationSnapshot,
  normalizeFormationStrength,
  normalizePolicy,
  normalizeSoldierAssignments,
  scaleResourceCost,
  sumAssignments,
  toInteger,
  validateRequestedAssignments,
};
