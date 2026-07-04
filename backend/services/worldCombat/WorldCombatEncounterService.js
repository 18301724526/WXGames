const BattleService = require('../BattleService');
const BattleSimService = require('../battle/BattleSimService');
const WorldMapService = require('../WorldMapService');
const FormationStrengthService = require('../military/FormationStrengthService');
const DefenderLeaderService = require('../DefenderLeaderService');
const { toInteger } = require('../../../shared/numberUtils');
const { cloneIfObject } = require('../../../shared/objectUtils');
const FormationDeploymentEligibility = require('../../../shared/formationDeploymentEligibility');

const SCHEMA = 'world-combat-encounters-v1';
const ENCOUNTER_ID = 'hostile_force_capital_ridge';
const RECENT_REPORT_LIMIT = 5;
const DEFAULT_OFFSET = Object.freeze({ q: 2, r: -1 });
const DEFAULT_FORCE = Object.freeze({
  soldiers: 40,
  quality: 'common',
  threat: 1,
  scale: 1,
});

function getCapitalCoord(gameState = {}) {
  const capital =
    (Array.isArray(gameState.territories) ? gameState.territories : []).find(
      (territory) => territory?.id === 'capital',
    ) || {};
  const origin = gameState.worldMap?.origin || {};
  return {
    q: toInteger(capital.q ?? capital.x ?? origin.q ?? origin.x, 0),
    r: toInteger(capital.r ?? capital.y ?? origin.r ?? origin.y, 0),
  };
}

function getEncounterCoord(gameState = {}) {
  const capital = getCapitalCoord(gameState);
  return {
    q: capital.q + DEFAULT_OFFSET.q,
    r: capital.r + DEFAULT_OFFSET.r,
  };
}

function getTerrain(gameState = {}, q = 0, r = 0, now = new Date()) {
  const worldMap = WorldMapService.ensureWorldMap(gameState, now);
  const tile = (Array.isArray(worldMap.tiles) ? worldMap.tiles : []).find(
    (item) => toInteger(item.q) === q && toInteger(item.r) === r,
  );
  return tile?.terrain || WorldMapService.chooseTerrain(worldMap.seed, q, r) || 'plains';
}

function createDefenderLeader(encounter = {}, now = new Date()) {
  const rawLeader = encounter.defender?.leader || encounter.leader || null;
  if (rawLeader && typeof rawLeader === 'object') return cloneIfObject(rawLeader);
  return DefenderLeaderService.createDefenderLeader(
    {
      id: encounter.id || ENCOUNTER_ID,
      type: 'camp',
      owner: 'tribe',
      naturalName: encounter.name || 'Hostile Patrol',
      defense: encounter.defender?.soldiers ?? DEFAULT_FORCE.soldiers,
      quality: encounter.defender?.quality || DEFAULT_FORCE.quality,
      threat: encounter.defender?.threat || DEFAULT_FORCE.threat,
      scale: encounter.defender?.scale || DEFAULT_FORCE.scale,
    },
    { createdAt: encounter.createdAt || now.toISOString() },
  );
}

function createEncounter(gameState = {}, now = new Date()) {
  const coord = getEncounterCoord(gameState);
  const tileId = WorldMapService.getTileId(coord.q, coord.r);
  const terrain = getTerrain(gameState, coord.q, coord.r, now);
  const createdAt = now.toISOString();
  return {
    id: ENCOUNTER_ID,
    kind: 'hostileForce',
    status: 'active',
    name: 'Frontier Patrol',
    nameKey: 'world.combat.encounter.frontierPatrol',
    q: coord.q,
    r: coord.r,
    tileId,
    terrain,
    unitKey: 'hostile_squad_default',
    createdAt,
    updatedAt: createdAt,
    defender: {
      id: `${ENCOUNTER_ID}_defender`,
      owner: 'hostile',
      soldiers: DEFAULT_FORCE.soldiers,
      quality: DEFAULT_FORCE.quality,
      threat: DEFAULT_FORCE.threat,
      scale: DEFAULT_FORCE.scale,
      leader: null,
    },
    battleReport: null,
    resolvedAt: null,
    resolvedByMissionId: null,
  };
}

function normalizeEncounter(rawEncounter = {}, gameState = {}, now = new Date()) {
  const fallback = createEncounter(gameState, now);
  const raw = rawEncounter && typeof rawEncounter === 'object' ? rawEncounter : {};
  const q = toInteger(raw.q ?? raw.x, fallback.q);
  const r = toInteger(raw.r ?? raw.y, fallback.r);
  const status = raw.status === 'resolved' ? 'resolved' : 'active';
  const minimumDefenderSoldiers = status === 'resolved' ? 0 : 1;
  const defenderRaw = raw.defender && typeof raw.defender === 'object' ? raw.defender : {};
  const encounter = {
    ...fallback,
    ...raw,
    id: raw.id || fallback.id,
    kind: raw.kind || fallback.kind,
    status,
    name: raw.name || fallback.name,
    nameKey: raw.nameKey || fallback.nameKey,
    q,
    r,
    tileId: WorldMapService.getTileId(q, r),
    terrain: raw.terrain || getTerrain(gameState, q, r, now),
    unitKey: raw.unitKey || fallback.unitKey,
    createdAt: raw.createdAt || fallback.createdAt,
    updatedAt: raw.updatedAt || raw.createdAt || fallback.updatedAt,
    defender: {
      ...fallback.defender,
      ...defenderRaw,
      id: defenderRaw.id || `${raw.id || fallback.id}_defender`,
      owner: defenderRaw.owner || 'hostile',
      soldiers: Math.max(
        minimumDefenderSoldiers,
        toInteger(defenderRaw.soldiers, fallback.defender.soldiers),
      ),
      quality: defenderRaw.quality || fallback.defender.quality,
      threat: Math.max(0, toInteger(defenderRaw.threat, fallback.defender.threat)),
      scale: Math.max(1, toInteger(defenderRaw.scale, fallback.defender.scale)),
      leader: defenderRaw.leader || null,
    },
    battleReport: raw.battleReport || null,
    resolvedAt: raw.resolvedAt || null,
    resolvedByMissionId: raw.resolvedByMissionId || null,
  };
  encounter.defender.leader = createDefenderLeader(encounter, now);
  return encounter;
}

function normalizeCombatState(gameState = {}, now = new Date()) {
  const rawState =
    gameState.worldCombat && typeof gameState.worldCombat === 'object' ? gameState.worldCombat : {};
  const rawEncounters = Array.isArray(rawState.encounters) ? rawState.encounters : [];
  const encountersById = new Map();
  rawEncounters.forEach((encounter) => {
    const normalized = normalizeEncounter(encounter, gameState, now);
    if (normalized.id) encountersById.set(normalized.id, normalized);
  });
  // Respawn the seeded encounter when it is missing or already resolved so the
  // hostile force is available to attack again (re-seeding keeps it active while
  // recentReports below preserves the finished battle reports).
  const seededExisting = encountersById.get(ENCOUNTER_ID);
  if (!seededExisting || seededExisting.status === 'resolved') {
    const seeded = normalizeEncounter(createEncounter(gameState, now), gameState, now);
    encountersById.set(seeded.id, seeded);
  }
  const recentReports = Array.isArray(rawState.recentReports)
    ? rawState.recentReports.filter(Boolean).slice(0, RECENT_REPORT_LIMIT)
    : [];
  gameState.worldCombat = {
    schema: SCHEMA,
    encounters: [...encountersById.values()],
    recentReports,
    // Carry the active interactive battle session through normalization so it is
    // not dropped while re-seeding encounters (the session service writes/reads it).
    session: rawState.session && typeof rawState.session === 'object' ? rawState.session : null,
    updatedAt: rawState.updatedAt || now.toISOString(),
  };
  return gameState.worldCombat;
}

function getActiveEncounter(gameState = {}, encounterId = '') {
  normalizeCombatState(gameState);
  return (
    (gameState.worldCombat.encounters || []).find(
      (encounter) => encounter.id === encounterId && encounter.status === 'active',
    ) || null
  );
}

function getActiveEncounterAt(gameState = {}, coord = {}) {
  normalizeCombatState(gameState);
  const tileId = WorldMapService.getTileId(
    toInteger(coord.q ?? coord.x, 0),
    toInteger(coord.r ?? coord.y, 0),
  );
  return (
    (gameState.worldCombat.encounters || []).find(
      (encounter) => encounter.status === 'active' && encounter.tileId === tileId,
    ) || null
  );
}

function getEncounterIdFromMarchOptions(options = {}) {
  return String(options.combatEncounterId || options.encounterId || '').trim();
}

function resolveMarchTarget(gameState = {}, options = {}, now = new Date()) {
  const encounterId = getEncounterIdFromMarchOptions(options);
  let encounter = null;
  if (encounterId) {
    encounter = getActiveEncounter(gameState, encounterId, now);
    if (!encounter) {
      return {
        success: false,
        error: 'WORLD_COMBAT_ENCOUNTER_NOT_FOUND',
        message: '该敌军已不在此处。',
      };
    }
  } else {
    // No explicit encounter id: marching onto a tile occupied by an active
    // hostile force is an attack on that force. The client does not always tag
    // it (e.g. when the formation is already parked on the encounter tile, or
    // when the target is picked via the tile selector), so resolve by tile.
    const rawQ = options.targetQ ?? options.q ?? options.x;
    const rawR = options.targetR ?? options.r ?? options.y;
    if (!Number.isFinite(Number(rawQ)) || !Number.isFinite(Number(rawR))) {
      return { success: true, encounter: null, target: null };
    }
    encounter = getActiveEncounterAt(gameState, {
      q: Math.floor(Number(rawQ)),
      r: Math.floor(Number(rawR)),
    });
    if (!encounter) return { success: true, encounter: null, target: null };
  }
  return {
    success: true,
    encounter,
    target: {
      q: encounter.q,
      r: encounter.r,
      tileId: encounter.tileId || WorldMapService.getTileId(encounter.q, encounter.r),
    },
  };
}

function getFamousPersonAttributes(gameState = {}, snapshot = {}) {
  const people = Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [];
  const byId = new Map(people.map((person) => [String(person.id), person]));
  return Object.fromEntries(
    (Array.isArray(snapshot.members) ? snapshot.members : []).map((member) => {
      const person = byId.get(String(member.personId)) || {};
      return [member.personId, cloneIfObject(person.attributes || {})];
    }),
  );
}

function getDefenderGenerals(encounter = {}) {
  const leader = encounter.defender?.leader || {};
  return [
    {
      gid: leader.id || `${encounter.id}_leader`,
      attributes: cloneIfObject(leader.attributes || {}),
      soldiers: Math.max(1, toInteger(encounter.defender?.soldiers, DEFAULT_FORCE.soldiers)),
    },
  ];
}

function getPrimaryLeaderName(gameState = {}, snapshot = {}) {
  const people = Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [];
  const firstMemberId = snapshot.members?.find((member) => member.soldiersCommitted > 0)?.personId;
  const person = people.find((item) => String(item.id) === String(firstMemberId));
  return person?.name || 'Field Commander';
}

function buildBattleReport(
  gameState = {},
  mission = {},
  encounter = {},
  battle = {},
  now = new Date(),
) {
  return buildEncounterBattleReport(gameState, {
    snapshotBefore: mission.formationSnapshot,
    encounter,
    battle,
    now,
  });
}

// Public, mission-agnostic report builder. Takes the attacker snapshot directly
// (the interactive session stores it on the session, not on a live mission) and
// produces the SAME report shape buildBattleReport emits, so recentReports and
// the passive BattleReplayOverlay consume it unchanged.
function buildEncounterBattleReport(
  gameState = {},
  { snapshotBefore = null, encounter = {}, battle = {}, now = new Date() } = {},
) {
  const snapshotBeforeNormalized =
    FormationStrengthService.normalizeFormationSnapshot(snapshotBefore) || {};
  const attackerStart = Math.max(
    0,
    toInteger(
      snapshotBeforeNormalized.soldiersRemaining,
      snapshotBeforeNormalized.soldiersCommitted,
    ),
  );
  const attackerEnd = Math.max(0, toInteger(battle.attackerSnapshot?.soldiersRemaining, 0));
  const defenderStart = Math.max(
    1,
    toInteger(encounter.defender?.soldiers, DEFAULT_FORCE.soldiers),
  );
  const defenderSurvivors = battle.result?.survivorsByGid || {};
  const defenderGid = getDefenderGenerals(encounter)[0]?.gid || '';
  const defenderEnd = Math.max(0, toInteger(defenderSurvivors[defenderGid], 0));
  const victory = battle.winner === 'attacker';
  const leaderName = getPrimaryLeaderName(gameState, snapshotBeforeNormalized);
  const defenderLeader = encounter.defender?.leader || {};
  const report = BattleService.createConquestSummaryReport(
    {
      id: `world_combat_${encounter.id}_${now.getTime()}`,
      soldiersCommitted: attackerStart,
      expedition: { leader: '', leaderSnapshot: { name: leaderName } },
    },
    {
      id: encounter.id,
      naturalName: encounter.name,
      defense: defenderStart,
      terrain: encounter.terrain,
      mapTerrain: encounter.terrain,
      battleTarget: getClientEncounterBattleTarget(encounter),
    },
    {
      success: victory,
      casualties: Math.max(0, attackerStart - attackerEnd),
    },
    now,
  );
  return {
    ...report,
    id: `world_combat_${encounter.id}_${now.getTime()}`,
    mode: 'entity-battle',
    result: victory ? 'victory' : 'defeat',
    summary: victory
      ? `${leaderName} defeated ${encounter.name}.`
      : `${leaderName} was forced back by ${encounter.name}.`,
    battleTarget: getClientEncounterBattleTarget(encounter),
    attacker: {
      ...(report.attacker || {}),
      leaderName,
      soldiersStart: attackerStart,
      soldiersEnd: attackerEnd,
      groupsStart: BattleService.getBattleVisualGroups(attackerStart),
      groupsEnd: BattleService.getBattleVisualGroups(attackerEnd),
    },
    defender: {
      ...(report.defender || {}),
      leaderId: defenderLeader.id || '',
      leaderName: defenderLeader.name || encounter.name,
      name: defenderLeader.name || encounter.name,
      leaderTitle: defenderLeader.title || 'Hostile Force',
      soldiersStart: defenderStart,
      soldiersEnd: victory ? 0 : defenderEnd,
      groupsStart: BattleService.getBattleVisualGroups(defenderStart),
      groupsEnd: BattleService.getBattleVisualGroups(victory ? 0 : defenderEnd),
      appearance: cloneIfObject(defenderLeader.appearance || {}),
    },
    visual: {
      ...(report.visual || {}),
      map: BattleService.getBattleStageForTerritory({
        terrain: encounter.terrain,
        mapTerrain: encounter.terrain,
      }),
    },
    simulation: cloneIfObject(battle.result || {}),
    // Deterministic replay inputs so the client can render the entity battle in
    // the battle scene (battleSimCore.createBattle(setup) + step(inputStream)).
    replay: {
      setup: cloneIfObject(battle.setup || null),
      inputStream: cloneIfObject(battle.inputStream || []),
    },
  };
}

function settleMissionSnapshot(mission = {}, nextSnapshot = null) {
  if (!nextSnapshot) return false;
  mission.formationSnapshot = nextSnapshot;
  if (mission.status !== 'idle') return true;
  return false;
}

function canSnapshotDeployForCombat(snapshot = null) {
  return !FormationDeploymentEligibility.getCombatDeploymentFailureForSnapshot(snapshot);
}

function resolveEncounterBattle(gameState = {}, mission = {}, encounter = {}, now = new Date()) {
  if (!mission?.formationSnapshot || encounter?.status !== 'active') return null;
  const snapshot = FormationStrengthService.normalizeFormationSnapshot(mission.formationSnapshot);
  if (!canSnapshotDeployForCombat(snapshot)) return null;
  const battle = BattleSimService.resolveBattle({
    seed: now.getTime() + String(encounter.id || '').length,
    attacker: {
      snapshot,
      attributesByPersonId: getFamousPersonAttributes(gameState, snapshot),
    },
    defender: {
      generals: getDefenderGenerals(encounter),
    },
    inputStream: [
      { tick: 0, type: 'order', side: 0, order: 'allOut' },
      { tick: 0, type: 'order', side: 1, order: 'allOut' },
    ],
  });
  const battleReport = buildBattleReport(gameState, mission, encounter, battle, now);
  settleMissionSnapshot(mission, battle.attackerSnapshot);
  encounter.battleReport = battleReport;
  encounter.resolvedAt = now.toISOString();
  encounter.resolvedByMissionId = mission.id || null;
  encounter.updatedAt = now.toISOString();
  if (battle.winner === 'attacker') {
    encounter.status = 'resolved';
    encounter.defender.soldiers = 0;
  } else {
    const defenderSurvivors = battle.result?.survivorsByGid || {};
    const defenderGid = getDefenderGenerals(encounter)[0]?.gid || '';
    encounter.defender.soldiers = Math.max(1, toInteger(defenderSurvivors[defenderGid], 0));
  }
  gameState.worldCombat.recentReports = [
    {
      id: battleReport.id,
      encounterId: encounter.id,
      missionId: mission.id || '',
      resolvedAt: now.toISOString(),
      report: battleReport,
    },
    ...(gameState.worldCombat.recentReports || []),
  ].slice(0, RECENT_REPORT_LIMIT);
  gameState.worldCombat.updatedAt = now.toISOString();
  mission.combat = {
    ...(mission.combat || {}),
    status: 'resolved',
    encounterId: encounter.id,
    resolvedAt: now.toISOString(),
    battleReportId: battleReport.id,
  };
  return {
    encounter,
    battleReport,
    winner: battle.winner,
    attackerSnapshot: battle.attackerSnapshot,
  };
}

function resolveMissionArrival(gameState = {}, mission = {}, now = new Date()) {
  normalizeCombatState(gameState, now);
  const combat = mission.combat && typeof mission.combat === 'object' ? mission.combat : null;
  if (!combat || combat.status === 'resolved') return null;
  const encounter = combat.encounterId
    ? getActiveEncounter(gameState, combat.encounterId)
    : getActiveEncounterAt(gameState, mission.position || mission.target || {});
  if (!encounter) return null;
  const targetTileId = WorldMapService.getTileId(encounter.q, encounter.r);
  const positionTileId = WorldMapService.getTileId(
    toInteger(mission.position?.q ?? mission.position?.x, mission.target?.q ?? 0),
    toInteger(mission.position?.r ?? mission.position?.y, mission.target?.r ?? 0),
  );
  if (positionTileId !== targetTileId) return null;
  return resolveEncounterBattle(gameState, mission, encounter, now);
}

// Attacking a hostile force the formation is already standing on resolves with no
// travel: mark the (single-step) route arrived and resolve the battle right away,
// so the formation returns to idle immediately instead of being busy for a full
// explore march step.
function resolveImmediateArrival(gameState = {}, mission = {}, coord = {}, now = new Date()) {
  const q = toInteger(coord.q ?? coord.x, 0);
  const r = toInteger(coord.r ?? coord.y, 0);
  const stamp = now && typeof now.toISOString === 'function' ? now.toISOString() : null;
  (Array.isArray(mission.route) ? mission.route : []).forEach((step) => {
    step.revealed = true;
    step.revealedAt = stamp;
  });
  mission.status = 'idle';
  mission.position = { q, r, tileId: WorldMapService.getTileId(q, r) };
  mission.nextStepAt = null;
  mission.completedAt = mission.completedAt || stamp;
  return resolveMissionArrival(gameState, mission, now);
}

function getClientEncounterBattleTarget(encounter = {}) {
  return {
    source: 'world-combat',
    tile: {
      id: encounter.tileId || WorldMapService.getTileId(encounter.q, encounter.r),
      q: encounter.q,
      r: encounter.r,
      terrain: encounter.terrain || 'plains',
    },
    site: {
      id: encounter.id || '',
      type: 'hostileForce',
      owner: 'hostile',
      status: encounter.status || 'active',
      name: encounter.name || 'Hostile Force',
      scale: Math.max(1, toInteger(encounter.defender?.scale, 1)),
      threat: Math.max(0, toInteger(encounter.defender?.threat, 0)),
      mapTerrain: encounter.terrain || 'plains',
      terrain: encounter.terrain || 'plains',
    },
    defender: encounter.defender
      ? {
          id: encounter.defender.id || '',
          owner: encounter.defender.owner || 'hostile',
          soldiers: Math.max(0, toInteger(encounter.defender.soldiers, 0)),
          quality: encounter.defender.quality || '',
          threat: Math.max(0, toInteger(encounter.defender.threat, 0)),
          scale: Math.max(1, toInteger(encounter.defender.scale, 1)),
          leader: cloneIfObject(encounter.defender.leader || null),
          generatedAt: encounter.createdAt || null,
        }
      : null,
    intelSnapshot: {
      knownTerrain: true,
      knownSite: true,
      knownOwner: true,
      knownGarrison: true,
      knownLeader: Boolean(encounter.defender?.leader),
      knownSkill: Boolean(encounter.defender?.leader?.abilityKit),
    },
  };
}

function getClientEncounter(encounter = {}) {
  const q = toInteger(encounter.q, 0);
  const r = toInteger(encounter.r, 0);
  const tileId = encounter.tileId || WorldMapService.getTileId(q, r);
  return {
    id: encounter.id || '',
    kind: encounter.kind || 'hostileForce',
    status: encounter.status || 'active',
    name: encounter.name || 'Hostile Force',
    nameKey: encounter.nameKey || '',
    q,
    r,
    tileId,
    terrain: encounter.terrain || 'plains',
    unitKey: encounter.unitKey || 'hostile_squad_default',
    defender: getClientEncounterBattleTarget(encounter).defender,
    battleTarget: getClientEncounterBattleTarget(encounter),
    resolvedAt: encounter.resolvedAt || null,
    resolvedByMissionId: encounter.resolvedByMissionId || null,
  };
}

function getClientState(gameState = {}, now = new Date()) {
  const state = normalizeCombatState(gameState, now);
  return {
    schema: state.schema || SCHEMA,
    encounters: (state.encounters || []).map(getClientEncounter),
    activeEncounters: (state.encounters || [])
      .filter((encounter) => encounter.status === 'active')
      .map(getClientEncounter),
    recentReports: (state.recentReports || []).map((entry) => cloneIfObject(entry)),
    updatedAt: state.updatedAt || null,
  };
}

module.exports = {
  ENCOUNTER_ID,
  SCHEMA,
  createEncounter,
  getActiveEncounter,
  getActiveEncounterAt,
  getClientEncounter,
  getClientEncounterBattleTarget,
  getClientState,
  getEncounterIdFromMarchOptions,
  getDefenderGenerals,
  getFamousPersonAttributes,
  buildBattleReport,
  buildEncounterBattleReport,
  settleMissionSnapshot,
  normalizeCombatState,
  normalizeEncounter,
  resolveEncounterBattle,
  resolveImmediateArrival,
  resolveMarchTarget,
  resolveMissionArrival,
};
