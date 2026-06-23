'use strict';

// Interactive world-combat session service. Owns the lifecycle of a single
// active, player-driven battle:
//   openSession  -> builds the authoritative battleSimCore setup (seed + setup
//                   issued server-side) and stores it on gameState.worldCombat.session.
//                   Does NOT simulate; the client plays the setup live and records
//                   the inputStream.
//   resolveSession -> re-simulates the stored setup with the client's recorded
//                   inputStream (authoritative), applies casualties, mutates the
//                   encounter, builds the report, and clears the session.
//
// The backend stays authoritative: seed + setup are server-stored, so the client
// cannot alter the outcome — at worst it replays a different inputStream, which is
// re-applied verbatim and re-judged by the deterministic core.

const WorldCombatEncounterService = require('./WorldCombatEncounterService');
const BattleSimService = require('../battle/BattleSimService');
const FormationStrengthService = require('../military/FormationStrengthService');

const SCHEMA = 'world-combat-session-v1';

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function clone(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
}

function normalizeFormationSlot(value) {
  const slot = toInteger(value, 1);
  return slot > 0 ? slot : 1;
}

function failure(error, message) {
  return { success: false, error, message };
}

// Find the source mission whose formationSnapshot is the attacker. Prefer an
// explicit missionId; otherwise match an idle mission by formation cityId + slot
// (same matching pattern as WorldExplorerActions.getIdleFormationMission).
function findSourceMission(gameState = {}, { missionId, cityId, formationSlot } = {}) {
  const missions = Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [];
  if (missionId) {
    const byId = missions.find((mission) => mission && mission.id === missionId);
    if (byId) return byId;
  }
  const wantCity = cityId || 'capital';
  const wantSlot = normalizeFormationSlot(formationSlot);
  return (
    missions.find((mission) => {
      if (!mission || mission.status !== 'idle') return false;
      const formation = mission.formation || {};
      return (
        (formation.cityId || 'capital') === wantCity &&
        normalizeFormationSlot(formation.slot) === wantSlot
      );
    }) || null
  );
}

function getSessionFormation(mission = {}, fallback = {}) {
  const formation = mission.formation || {};
  return {
    cityId: formation.cityId || fallback.cityId || 'capital',
    slot: normalizeFormationSlot(formation.slot != null ? formation.slot : fallback.slot),
  };
}

// Open an interactive battle session. Authoritative: builds seed + setup here.
function openSession(
  gameState = {},
  { missionId = '', formationSlot, cityId = 'capital', targetQ, targetR } = {},
  now = new Date(),
) {
  WorldCombatEncounterService.normalizeCombatState(gameState, now);

  const existing = gameState.worldCombat.session;
  if (existing && existing.status === 'open') {
    return failure('WORLD_COMBAT_SESSION_BUSY', 'An interactive battle is already in progress.');
  }

  const encounter = WorldCombatEncounterService.getActiveEncounterAt(gameState, {
    q: targetQ,
    r: targetR,
  });
  if (!encounter) {
    return failure('WORLD_COMBAT_ENCOUNTER_NOT_FOUND', 'Combat encounter is no longer available.');
  }

  const mission = findSourceMission(gameState, { missionId, cityId, formationSlot });
  const rawSnapshot = mission ? mission.formationSnapshot : null;
  const snapshot = FormationStrengthService.normalizeFormationSnapshot(rawSnapshot);
  const hasGeneral = Boolean(
    snapshot && (snapshot.members || []).some((member) => member && member.personId),
  );
  if (!snapshot || (snapshot.soldiersRemaining <= 0 && !hasGeneral)) {
    return failure('WORLD_COMBAT_NO_TROOPS', 'No troops available to attack.');
  }

  const attributesByPersonId = WorldCombatEncounterService.getFamousPersonAttributes(
    gameState,
    snapshot,
  );
  const defenderGenerals = WorldCombatEncounterService.getDefenderGenerals(encounter);

  // Same deterministic seed formula as legacy resolveEncounterBattle so balance
  // is unchanged between the passive and interactive paths.
  const seed = now.getTime() + String(encounter.id || '').length;

  const setup = BattleSimService.buildBattleSetup({
    seed,
    attacker: { snapshot, attributesByPersonId },
    defender: { generals: defenderGenerals },
  });

  const formationRef = getSessionFormation(mission || {}, { cityId, slot: formationSlot });
  const battleId = `wcs_${encounter.id}_${now.getTime()}`;
  const startedAt = now.toISOString();

  const session = {
    schema: SCHEMA,
    battleId,
    seed,
    status: 'open',
    encounterId: encounter.id,
    missionId: (mission && mission.id) || '',
    formation: formationRef,
    setup,
    attackerSnapshot: clone(snapshot),
    startedAt,
  };

  gameState.worldCombat.session = session;
  gameState.worldCombat.updatedAt = startedAt;

  // Mark the mission/squad 战斗中. Do NOT alter mission.route/position.
  if (mission) {
    mission.combat = {
      ...(mission.combat || {}),
      encounterId: encounter.id,
      status: 'inBattle',
      battleId,
      startedAt,
    };
  }

  return {
    success: true,
    battleId,
    seed,
    setup: clone(setup),
    encounter: WorldCombatEncounterService.getClientEncounter(encounter),
    battleTarget: WorldCombatEncounterService.getClientEncounterBattleTarget(encounter),
    session: clone(session),
  };
}

// Resolve an open session: re-sim the stored setup with the client inputStream,
// apply casualties, mutate the encounter, build the report, clear the session.
function resolveSession(
  gameState = {},
  { battleId = '', inputStream = [] } = {},
  now = new Date(),
) {
  WorldCombatEncounterService.normalizeCombatState(gameState, now);

  const session = gameState.worldCombat.session;
  if (!session || session.status !== 'open') {
    return failure('WORLD_COMBAT_SESSION_NOT_FOUND', 'No active battle to resolve.');
  }
  if (session.battleId !== battleId) {
    return failure('WORLD_COMBAT_SESSION_MISMATCH', 'Battle id does not match the active session.');
  }

  const stream = Array.isArray(inputStream) ? inputStream : [];

  // Authoritative re-simulation: seed + setup are server-stored.
  const result = BattleSimService.simulateSetup(session.setup, stream);
  const winner = result.winner;

  const attackerSnapshot = BattleSimService.applyCasualtiesToFormationSnapshot(
    session.attackerSnapshot,
    result,
  );

  const resolvedAt = now.toISOString();
  const encounter = WorldCombatEncounterService.getActiveEncounter(gameState, session.encounterId);

  // Encounter may have been resolved/respawned concurrently; if it is gone we
  // still settle the session and return a report for the client.
  let battleTargetEncounter = encounter;
  if (encounter) {
    const defenderGid = WorldCombatEncounterService.getDefenderGenerals(encounter)[0]?.gid || '';
    if (winner === 'attacker') {
      encounter.status = 'resolved';
      encounter.defender.soldiers = 0;
    } else {
      const survivors = (result && result.survivorsByGid) || {};
      encounter.defender.soldiers = Math.max(1, toInteger(survivors[defenderGid], 0));
    }
    encounter.resolvedAt = resolvedAt;
    encounter.resolvedByMissionId = session.missionId || null;
    encounter.updatedAt = resolvedAt;
  }

  const report = WorldCombatEncounterService.buildEncounterBattleReport(gameState, {
    snapshotBefore: session.attackerSnapshot,
    encounter: battleTargetEncounter || { id: session.encounterId, defender: {} },
    battle: {
      result,
      winner,
      attackerSnapshot,
      setup: session.setup,
      inputStream: stream,
    },
    now,
  });

  if (encounter) {
    encounter.battleReport = report;
  }

  // Transition the squad/mission back: write casualties onto the live mission's
  // snapshot and mark its combat record resolved.
  const mission = findSourceMission(gameState, {
    missionId: session.missionId,
    cityId: session.formation?.cityId,
    formationSlot: session.formation?.slot,
  });
  if (mission) {
    WorldCombatEncounterService.settleMissionSnapshot(mission, attackerSnapshot);
    mission.combat = {
      ...(mission.combat || {}),
      status: 'resolved',
      encounterId: session.encounterId,
      battleId,
      resolvedAt,
      battleReportId: report.id,
    };
  }

  gameState.worldCombat.recentReports = [
    {
      id: report.id,
      encounterId: session.encounterId,
      missionId: session.missionId || '',
      battleId,
      resolvedAt,
      report,
    },
    ...(gameState.worldCombat.recentReports || []),
  ].slice(0, 5);

  gameState.worldCombat.session = null;
  gameState.worldCombat.updatedAt = resolvedAt;

  return {
    success: true,
    result,
    report,
    winner,
    encounter: encounter ? WorldCombatEncounterService.getClientEncounter(encounter) : null,
    attackerSnapshot,
  };
}

module.exports = {
  SCHEMA,
  openSession,
  resolveSession,
};
