'use strict';

const NumberUtils = (() => {
  if (typeof require === 'function') {
    try {
      return require('./numberUtils');
    } catch (_error) {
      // Browser fallback below.
    }
  }
  return typeof globalThis !== 'undefined' ? globalThis.NumberUtils : null;
})();

const toNonNegativeInteger =
  NumberUtils?.toNonNegativeInteger ||
  ((value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  });

const BLOCKER_EMPTY_FORMATION = 'FORMATION_EMPTY';
const BLOCKER_PRIMARY_NO_SOLDIERS = 'FORMATION_PRIMARY_NO_SOLDIERS';
const WARNING_DEPUTY_NO_SOLDIERS = 'FORMATION_DEPUTY_NO_SOLDIERS';
const COMBAT_ERROR_NO_TROOPS = 'WORLD_COMBAT_NO_TROOPS';
const COMBAT_ERROR_PRIMARY_NO_SOLDIERS = 'WORLD_COMBAT_PRIMARY_NO_SOLDIERS';

function normalizeName(value = '', fallback = '') {
  const name = String(value || '').trim();
  return name || fallback;
}

function normalizePersonId(value = '') {
  return String(value || '').trim();
}

function normalizeAssignments(source = {}) {
  const assignments = source && typeof source === 'object' ? source : {};
  return Object.fromEntries(
    Object.entries(assignments)
      .map(([id, value]) => [normalizePersonId(id), toNonNegativeInteger(value, 0)])
      .filter(([id]) => id),
  );
}

function getMemberId(member = {}) {
  return normalizePersonId(member.personId || member.id || member.memberId || member.gid);
}

function getMemberName(member = {}, personId = '') {
  return normalizeName(
    member.name || member.displayName || member.label || member.title,
    personId || 'Unknown',
  );
}

function getMemberSoldiers(member = {}, assignments = {}) {
  const personId = getMemberId(member);
  const value =
    member.soldiersAssigned ??
    member.soldiersRemaining ??
    member.soldiersCommitted ??
    member.soldiers ??
    member.count ??
    assignments[personId];
  return toNonNegativeInteger(value, 0);
}

function buildParticipantsFromMembers(members = [], assignments = {}) {
  return (Array.isArray(members) ? members : [])
    .map((member, index) => {
      const personId = getMemberId(member);
      if (!personId) return null;
      return {
        index,
        role: index === 0 ? 'primary' : 'deputy',
        personId,
        name: getMemberName(member, personId),
        soldiers: getMemberSoldiers(member, assignments),
      };
    })
    .filter(Boolean);
}

function buildParticipantsFromMemberIds(memberIds = [], assignments = {}, options = {}) {
  const namesByPersonId =
    options.namesByPersonId && typeof options.namesByPersonId === 'object'
      ? options.namesByPersonId
      : {};
  return (Array.isArray(memberIds) ? memberIds : [])
    .map((rawId, index) => {
      const personId = normalizePersonId(rawId);
      if (!personId) return null;
      return {
        index,
        role: index === 0 ? 'primary' : 'deputy',
        personId,
        name: normalizeName(namesByPersonId[personId], personId),
        soldiers: toNonNegativeInteger(assignments[personId], 0),
      };
    })
    .filter(Boolean);
}

function getFormationParticipants(formation = {}, options = {}) {
  const assignments = normalizeAssignments(
    formation.soldierAssignments || formation.memberSoldiers || options.soldierAssignments || {},
  );
  if (Array.isArray(formation.members) && formation.members.length > 0) {
    return buildParticipantsFromMembers(formation.members, assignments);
  }
  if (Array.isArray(formation.memberIds) && formation.memberIds.length > 0) {
    return buildParticipantsFromMemberIds(formation.memberIds, assignments, options);
  }
  return [];
}

function makeBlocker(code, messageKey, participant = null) {
  return {
    code,
    messageKey,
    participant,
    personId: participant?.personId || '',
    name: participant?.name || '',
  };
}

function makeWarning(code, messageKey, participants = []) {
  return {
    code,
    messageKey,
    participants,
    personIds: participants.map((participant) => participant.personId),
    names: participants.map((participant) => participant.name),
  };
}

function evaluateFormationDeployment(formation = {}, options = {}) {
  const participants = getFormationParticipants(formation, options);
  const primary = participants[0] || null;
  const deputies = participants.slice(1);
  const blockers = [];
  const warnings = [];

  if (!primary) {
    blockers.push(makeBlocker(BLOCKER_EMPTY_FORMATION, 'world.march.deploy.emptyFormation'));
  } else if (primary.soldiers <= 0) {
    blockers.push(
      makeBlocker(BLOCKER_PRIMARY_NO_SOLDIERS, 'world.march.deploy.primaryNoSoldiers', primary),
    );
  }

  const zeroSoldierDeputies = deputies.filter((participant) => participant.soldiers <= 0);
  if (primary && primary.soldiers > 0 && zeroSoldierDeputies.length > 0) {
    warnings.push(
      makeWarning(
        WARNING_DEPUTY_NO_SOLDIERS,
        zeroSoldierDeputies.length > 1
          ? 'world.march.deploy.deputiesNoSoldiers'
          : 'world.march.deploy.deputyNoSoldiers',
        zeroSoldierDeputies,
      ),
    );
  }

  return {
    allowed: blockers.length === 0,
    blocked: blockers.length > 0,
    blockers,
    warnings,
    participants,
    primary,
    deputies,
    zeroSoldierDeputies,
    soldiersAssigned: participants.reduce((sum, participant) => sum + participant.soldiers, 0),
  };
}

function evaluateFormationSnapshotDeployment(snapshot = null) {
  if (!snapshot) return evaluateFormationDeployment({ memberIds: [] });
  return evaluateFormationDeployment({
    members: Array.isArray(snapshot.members) ? snapshot.members : [],
  });
}

function normalizeEligibility(source = {}) {
  if (source && typeof source === 'object' && Array.isArray(source.blockers)) return source;
  return evaluateFormationDeployment(source);
}

function getCombatDeploymentFailure(source = {}) {
  const eligibility = normalizeEligibility(source);
  if (!eligibility.blocked) return null;
  const blocker = eligibility.blockers?.[0] || {};
  if (blocker.code === BLOCKER_PRIMARY_NO_SOLDIERS) {
    return {
      success: false,
      error: COMBAT_ERROR_PRIMARY_NO_SOLDIERS,
      message: '主将没有配置士兵。',
      blocker,
    };
  }
  return {
    success: false,
    error: COMBAT_ERROR_NO_TROOPS,
    message: '没有可出战的部队。',
    blocker,
  };
}

function getCombatDeploymentFailureForSnapshot(snapshot = null) {
  return getCombatDeploymentFailure(evaluateFormationSnapshotDeployment(snapshot));
}

const api = {
  BLOCKER_EMPTY_FORMATION,
  BLOCKER_PRIMARY_NO_SOLDIERS,
  COMBAT_ERROR_NO_TROOPS,
  COMBAT_ERROR_PRIMARY_NO_SOLDIERS,
  WARNING_DEPUTY_NO_SOLDIERS,
  evaluateFormationDeployment,
  evaluateFormationSnapshotDeployment,
  getCombatDeploymentFailure,
  getCombatDeploymentFailureForSnapshot,
  getFormationParticipants,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.FormationDeploymentEligibility = api;
