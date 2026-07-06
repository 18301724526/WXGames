const BattleService = require('../BattleService');
const BattleSimService = require('../battle/BattleSimService');
const WorldMapService = require('../WorldMapService');
const FormationStrengthService = require('../military/FormationStrengthService');
const DefenderLeaderService = require('../DefenderLeaderService');
const WorldCampSpawner = require('./WorldCampSpawner');
const CityService = require('../CityService');
// SINGLE SOURCE for the "player has revealed this tile" test — the exact same
// getCoordinateKey + worldMap.tiles pair the neutral-city fog gate
// (TerritoryClientAssembler.filterDiscoveredNeutralCities) uses. Reused here so a hostile
// encounter appears on a player's client map under identical fog rules — no second reveal source.
const TerritoryClientAssembler = require('../TerritoryClientAssembler');
const { toInteger } = require('../../../shared/numberUtils');
const { cloneIfObject } = require('../../../shared/objectUtils');
const FormationDeploymentEligibility = require('../../../shared/formationDeploymentEligibility');

// City resource keys a camp loot table may pay out. Kept in sync with the canonical
// resource set the rest of the backend accepts; anything outside this is dropped so a
// bad loot table can never invent a resource.
const LOOT_RESOURCE_KEYS = Object.freeze(['food', 'wood', 'knowledge', 'iron', 'stone', 'metal']);

const SCHEMA = 'world-combat-encounters-v1';
const ENCOUNTER_ID = 'hostile_force_capital_ridge';
const RECENT_REPORT_LIMIT = 5;
// How long an 'engaged' mission (arrived on an enemy tile, waiting for the player to
// play the interactive battle) may sit before the server force-settles it with an
// allOut fallback. This is the offline safety net: a player who never opens the battle
// scene (closed the tab, left it engaged) must not strand the formation forever. The
// interactive path clears 'engaged' the moment resolveSession runs, so the timeout only
// ever fires when nobody is playing the fight. Exported so tests + tuning share one value.
const AUTO_ENGAGE_FALLBACK_MS = 45000;
// How long an interactive battle session may stay 'open' (a player playing the fight)
// before it is forfeited as orphaned. Generous — a real fight is seconds — so this only
// reaps sessions abandoned by a closed tab. Longer than AUTO_ENGAGE_FALLBACK_MS so a live
// fight is never reaped out from under the player.
const SESSION_STALE_MS = 5 * 60 * 1000;
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
      // Camp garrison at full strength (used to restore a resolved camp on respawn).
      // Absent on the stub/legacy saves ⇒ 0, which the respawn helper treats as "no
      // camp reset applies".
      baseSoldiers: Math.max(0, toInteger(defenderRaw.baseSoldiers, 0)),
      leader: defenderRaw.leader || null,
    },
    battleReport: raw.battleReport || null,
    resolvedAt: raw.resolvedAt || null,
    resolvedByMissionId: raw.resolvedByMissionId || null,
    // Camp passthrough fields (slice 1a). Absent on the legacy stub / legacy saves, so
    // they normalize to inert defaults (null / []) and legacy readers ignore them.
    campArchetypeKey:
      typeof raw.campArchetypeKey === 'string' && raw.campArchetypeKey
        ? raw.campArchetypeKey
        : null,
    lootTable: raw.lootTable && typeof raw.lootTable === 'object' ? { ...raw.lootTable } : null,
    respawnCooldownMs: Math.max(0, toInteger(raw.respawnCooldownMs, 0)),
    respawnAt: raw.respawnAt || null,
  };
  encounter.defender.leader = createDefenderLeader(encounter, now);
  return encounter;
}

function isCampEncounter(encounter = {}) {
  return Boolean(encounter && encounter.campArchetypeKey);
}

// Reset a resolved camp back to active once its respawn cooldown has elapsed. No-op for
// the legacy stub (not a camp) and for camps still inside their cooldown window. Restores
// the original garrison, clears the finished-battle bookkeeping, and drops respawnAt.
function respawnCampIfReady(encounter = {}, now = new Date()) {
  if (!isCampEncounter(encounter) || encounter.status !== 'resolved') return false;
  const respawnAtMs = encounter.respawnAt ? Date.parse(encounter.respawnAt) : Number.NaN;
  // A resolved camp with no respawnAt (e.g. hand-authored) never revives on its own.
  if (!Number.isFinite(respawnAtMs) || now.getTime() < respawnAtMs) return false;
  const baseSoldiers = Math.max(1, toInteger(encounter.defender?.baseSoldiers, 1));
  encounter.status = 'active';
  encounter.defender.soldiers = baseSoldiers;
  encounter.battleReport = null;
  encounter.resolvedAt = null;
  encounter.resolvedByMissionId = null;
  encounter.respawnAt = null;
  encounter.updatedAt = now.toISOString();
  return true;
}

// Canonical resource credit: mutate the active city's resource object (the top-level
// gameState.resources is an alias of it), clamped at zero, exactly like EventService's
// resource effects. Returns the {key:amount} map actually granted (filtered to valid
// resource keys and positive amounts) for the battle report's loot field.
function awardCampLoot(gameState = {}, lootTable = null) {
  if (!lootTable || typeof lootTable !== 'object') return {};
  const city = CityService.getActiveCity(gameState);
  if (!city) return {};
  city.resources = city.resources || {};
  const granted = {};
  LOOT_RESOURCE_KEYS.forEach((key) => {
    const amount = toInteger(lootTable[key], 0);
    if (amount <= 0) return;
    city.resources[key] = Math.max(0, (city.resources[key] || 0) + amount);
    granted[key] = amount;
  });
  return granted;
}

// SINGLE SOURCE for camp victory rewards, called by BOTH resolution paths (the passive
// march-arrival battle in resolveEncounterBattle AND the interactive session in
// WorldCombatSessionService.resolveSession) so loot + respawn cooldown are identical
// however the camp was defeated. Assumes the caller has already set status='resolved'.
// The legacy stub has no lootTable/respawnCooldownMs, so it grants nothing and never
// sets respawnAt — normalizeCombatState keeps respawning it unconditionally (unchanged).
function applyCampVictorySpoils(gameState = {}, encounter = {}, now = new Date()) {
  if (!isCampEncounter(encounter)) return {};
  const loot = awardCampLoot(gameState, encounter.lootTable);
  const cooldownMs = Math.max(0, toInteger(encounter.respawnCooldownMs, 0));
  encounter.respawnAt = cooldownMs > 0 ? new Date(now.getTime() + cooldownMs).toISOString() : null;
  return loot;
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
  // Respawn the LEGACY single stub when it is missing or already resolved so the hostile
  // force is available to attack again (re-seeding keeps it active while recentReports
  // below preserves the finished battle reports). The stub keeps its original
  // unconditional-respawn behavior for backward compatibility — it carries no respawn
  // cooldown, whereas the camps below are cooldown-gated.
  const seededExisting = encountersById.get(ENCOUNTER_ID);
  if (!seededExisting || seededExisting.status === 'resolved') {
    const seeded = normalizeEncounter(createEncounter(gameState, now), gameState, now);
    encountersById.set(seeded.id, seeded);
  }
  // Deterministically lay out the wild camps (idempotent — will not duplicate or
  // overwrite live camp progress). Writing back through gameState.worldCombat first so
  // the spawner appends into the array we then re-read; each appended camp is normalized.
  gameState.worldCombat = {
    ...(gameState.worldCombat || {}),
    encounters: [...encountersById.values()],
  };
  WorldCampSpawner.seedCampEncounters(gameState, now).forEach((encounter) => {
    const normalized = normalizeEncounter(encounter, gameState, now);
    if (normalized.id && !encountersById.has(normalized.id)) {
      encountersById.set(normalized.id, normalized);
    }
  });
  // Cooldown-gated respawn for resolved camps: a camp only returns to 'active' once the
  // wall-clock has passed its respawnAt. Removing this block reverts camps to the stub's
  // unconditional respawn (safe rollback).
  encountersById.forEach((encounter) => {
    respawnCampIfReady(encounter, now);
  });
  const recentReports = Array.isArray(rawState.recentReports)
    ? rawState.recentReports.filter(Boolean).slice(0, RECENT_REPORT_LIMIT)
    : [];
  gameState.worldCombat = {
    schema: SCHEMA,
    encounters: [...encountersById.values()],
    recentReports,
    // Carry the active interactive battle session through normalization so it is
    // not dropped while re-seeding encounters (the session service writes/reads it) —
    // UNLESS it has gone stale (see below), in which case it is forfeited.
    session: reapStaleSession(rawState.session, gameState, now),
    updatedAt: rawState.updatedAt || now.toISOString(),
  };
  return gameState.worldCombat;
}

// Orphaned-session self-heal. A player who closes the tab mid-battle (or any client that
// opens a session and never resolves it) would otherwise leave worldCombat.session 'open'
// forever, permanently blocking new combat with WORLD_COMBAT_SESSION_BUSY. If an open
// session has been sitting past SESSION_STALE_MS, forfeit it: drop the session and reset
// its mission from 'inBattle' back to 'engaged' (fresh engagedAt) so the normal engaged
// flow (frontend re-open or the allOut timeout fallback) takes over. No result is applied
// — the abandoned fight simply did not happen.
function reapStaleSession(session, gameState = {}, now = new Date()) {
  if (!session || typeof session !== 'object') return null;
  if (session.status !== 'open') return session;
  const startedMs = session.startedAt ? Date.parse(session.startedAt) : Number.NaN;
  // Only reap a session we can PROVE is stale: a valid startedAt older than the threshold.
  // A session with no parseable startedAt is kept (we cannot show it is abandoned).
  if (!Number.isFinite(startedMs) || now.getTime() - startedMs <= SESSION_STALE_MS) return session;
  const missions = Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [];
  const mission = missions.find((m) => m && m.id && m.id === session.missionId);
  if (mission && mission.combat && mission.combat.status === 'inBattle') {
    mission.combat = {
      ...mission.combat,
      status: 'engaged',
      engagedAt: now.toISOString(),
      battleId: null,
    };
  }
  return null;
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
  battleReport.loot = {};
  if (battle.winner === 'attacker') {
    encounter.status = 'resolved';
    encounter.defender.soldiers = 0;
    battleReport.loot = applyCampVictorySpoils(gameState, encounter, now);
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

// Locate the active encounter a mission has ARRIVED on (position tile == encounter tile),
// or null if the mission has no pending combat, is not standing on its target, or the
// encounter is gone. Shared by the arrival hook and the engaged-timeout fallback so both
// agree on "is this mission on top of a live enemy right now".
function getArrivedEncounterForMission(gameState = {}, mission = {}) {
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
  return encounter;
}

// Arrival hook: the formation has reached the enemy tile. Instead of immediately
// resolving the battle (legacy allOut auto-settle), mark the mission 'engaged' and leave
// it UNSETTLED. The frontend then opens the interactive battle (the "retreat window"); a
// player who never plays it is caught by resolveEngagedTimeouts below. Returns an
// { engaged, encounter } marker so callers can tell an engagement was set up, or null when
// there is nothing to fight. ROLLBACK: replace the engaged block with
// `return resolveEncounterBattle(gameState, mission, encounter, now)` to restore the old
// allOut auto-settle on arrival.
function resolveMissionArrival(gameState = {}, mission = {}, now = new Date()) {
  normalizeCombatState(gameState, now);
  const encounter = getArrivedEncounterForMission(gameState, mission);
  if (!encounter) return null;
  // Already engaged (or resolving via a session) on THIS encounter: leave it alone so a
  // re-run of the arrival pass does not reset engagedAt and re-arm the timeout.
  if (mission.combat?.status === 'engaged' && mission.combat.encounterId === encounter.id) {
    return { engaged: true, encounter };
  }
  mission.combat = {
    ...(mission.combat || {}),
    status: 'engaged',
    encounterId: encounter.id,
    engagedAt: now.toISOString(),
    battleReportId: null,
  };
  return { engaged: true, encounter };
}

// Offline safety net. Walk the missions and force-settle any that have been sitting
// 'engaged' longer than AUTO_ENGAGE_FALLBACK_MS with an allOut resolveEncounterBattle —
// UNLESS the player is actively playing that encounter's interactive battle (an open
// session for the same encounter), in which case we defer to resolveSession so we never
// double-settle a fight in progress. Runs on the worker tick + heartbeat settlement, so
// engaged formations can never strand. Returns the number of missions force-settled.
function resolveEngagedTimeouts(gameState = {}, now = new Date()) {
  normalizeCombatState(gameState, now);
  const missions = Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [];
  const nowMs = now.getTime();
  const session = gameState.worldCombat?.session;
  const openSessionEncounterId = session && session.status === 'open' ? session.encounterId : null;
  let settled = 0;
  for (const mission of missions) {
    const combat = mission.combat && typeof mission.combat === 'object' ? mission.combat : null;
    if (!combat || combat.status !== 'engaged') continue;
    const engagedAtMs = combat.engagedAt ? Date.parse(combat.engagedAt) : Number.NaN;
    if (!Number.isFinite(engagedAtMs) || nowMs - engagedAtMs <= AUTO_ENGAGE_FALLBACK_MS) continue;
    // Player is mid-fight on this exact encounter: let the interactive session resolve it.
    if (openSessionEncounterId && openSessionEncounterId === combat.encounterId) continue;
    const encounter = getArrivedEncounterForMission(gameState, mission);
    if (!encounter) continue;
    if (resolveEncounterBattle(gameState, mission, encounter, now)) settled += 1;
  }
  return settled;
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

// "Fought before" = a battleReport was written by a resolved battle (buildBattleReport /
// resolveSession). It is the SINGLE fact that unlocks defender strength for this player: strength is
// learned from the battle, not from scouting. A respawn clears battleReport (normalizeEncounter /
// respawn), so a reborn camp is unknown again — "打了才知道" holds across the lifecycle.
function hasFoughtEncounter(encounter = {}) {
  return Boolean(encounter && encounter.battleReport);
}

function getClientEncounterBattleTarget(encounter = {}) {
  // Strength intel (garrison count / leader / threat / scale) is projected ONLY after the player has
  // fought this encounter. Until then defender is null and the intel flags read false, so the DTO
  // never carries a number the player has not earned in battle. The tile/site/terrain (needed to
  // render + target the actor) stay known.
  const fought = hasFoughtEncounter(encounter);
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
      // scale/threat describe defender strength — withheld until fought (0 = unknown, not "no threat").
      scale: fought ? Math.max(1, toInteger(encounter.defender?.scale, 1)) : 0,
      threat: fought ? Math.max(0, toInteger(encounter.defender?.threat, 0)) : 0,
      mapTerrain: encounter.terrain || 'plains',
      terrain: encounter.terrain || 'plains',
    },
    defender: fought && encounter.defender
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
      knownGarrison: fought,
      knownLeader: fought && Boolean(encounter.defender?.leader),
      knownSkill: fought && Boolean(encounter.defender?.leader?.abilityKit),
    },
  };
}

function getClientEncounter(encounter = {}) {
  const q = toInteger(encounter.q, 0);
  const r = toInteger(encounter.r, 0);
  const tileId = encounter.tileId || WorldMapService.getTileId(q, r);
  const battleTarget = getClientEncounterBattleTarget(encounter);
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
    // defender is already fog-gated inside getClientEncounterBattleTarget (null until fought).
    defender: battleTarget.defender,
    battleTarget,
    resolvedAt: encounter.resolvedAt || null,
    resolvedByMissionId: encounter.resolvedByMissionId || null,
  };
}

// Fog gate for hostile encounters — the client-projection twin of the neutral-city gate.
// An encounter lives in the shared world state unconditionally (worker/heartbeat settle it all the
// same), but it must stay HIDDEN in a player's client DTO until that player's march vision has
// revealed its tile. The player's worldMap.tiles is already reveal-streamed, so an encounter is
// "discovered" for this player exactly when a revealed tile sits at its coordinate — the identical
// rule filterDiscoveredNeutralCities applies to cities, via the SAME getCoordinateKey source.
function isEncounterRevealed(encounter, visibleTileCoords) {
  return visibleTileCoords.has(TerritoryClientAssembler.getCoordinateKey(encounter));
}

function getClientState(gameState = {}, now = new Date()) {
  const state = normalizeCombatState(gameState, now);
  const tiles = Array.isArray(gameState.worldMap?.tiles) ? gameState.worldMap.tiles : [];
  const visibleTileCoords = new Set(
    tiles.map((tile) => TerritoryClientAssembler.getCoordinateKey(tile)),
  );
  const revealedEncounters = (state.encounters || []).filter((encounter) =>
    isEncounterRevealed(encounter, visibleTileCoords),
  );
  return {
    schema: state.schema || SCHEMA,
    encounters: revealedEncounters.map(getClientEncounter),
    activeEncounters: revealedEncounters
      .filter((encounter) => encounter.status === 'active')
      .map(getClientEncounter),
    recentReports: (state.recentReports || []).map((entry) => cloneIfObject(entry)),
    updatedAt: state.updatedAt || null,
  };
}

module.exports = {
  ENCOUNTER_ID,
  SCHEMA,
  AUTO_ENGAGE_FALLBACK_MS,
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
  resolveEngagedTimeouts,
  resolveImmediateArrival,
  resolveMarchTarget,
  resolveMissionArrival,
  respawnCampIfReady,
  awardCampLoot,
  applyCampVictorySpoils,
  isCampEncounter,
};
