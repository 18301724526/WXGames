const BattleConfig = require('../../config/BattleConfig');
const BattleSimService = require('./BattleSimService');
const {
  clone,
  getBattleVisualGroups,
  normalizeAttributes,
  toInteger,
} = require('./BattleShared');
const {
  createBattleLeaders,
} = require('./BattleLeaders');
const {
  createBattleReports,
} = require('./BattleReports');

const {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
} = BattleConfig;

const battleLeaders = createBattleLeaders({ BattleConfig });
const battleReports = createBattleReports({
  BattleConfig,
  DEFAULT_SOLDIER_SCALE,
});

const DEFAULT_INPUT_STREAM = Object.freeze([
  Object.freeze({ tick: 0, type: 'order', side: 0, order: 'allOut' }),
  Object.freeze({ tick: 0, type: 'order', side: 1, order: 'allOut' }),
]);

function getTimestamp(now = new Date()) {
  return now && typeof now.toISOString === 'function' ? now.toISOString() : new Date(now).toISOString();
}

function getNowMs(now = new Date()) {
  return now && typeof now.getTime === 'function' ? now.getTime() : new Date(now).getTime();
}

function getMissionLeader(gameState = {}, mission = {}) {
  return battleLeaders.getLeaderSnapshot(gameState, mission.expedition?.leader)
    || battleLeaders.getLeaderSnapshotFromMission(mission)
    || BattleConfig.getFallbackLeader();
}

function buildAttackerSnapshot(gameState = {}, mission = {}, now = new Date()) {
  const leader = getMissionLeader(gameState, mission);
  const leaderId = String(leader.id || mission.expedition?.leader || 'unavailable');
  const soldiersCommitted = Math.max(0, toInteger(mission.soldiersCommitted, 0));
  const sourceCityId = mission.sourceCityId
    || mission.soldierAllocations?.[0]?.cityId
    || gameState.activeCityId
    || 'capital';
  return {
    leader,
    attributesByPersonId: {
      [leaderId]: normalizeAttributes(leader.attributes || {}),
    },
    snapshot: {
      schema: 'formation-snapshot-v1',
      sourceCityId,
      slot: 1,
      members: [{
        personId: leaderId,
        soldiersCommitted,
        soldiersRemaining: soldiersCommitted,
      }],
      soldiersCommitted,
      soldiersRemaining: soldiersCommitted,
      lockedAt: mission.startedAt || getTimestamp(now),
      settledAt: null,
    },
  };
}

function getDefenderSoldiers(territory = {}) {
  return Math.max(
    MIN_BATTLE_SOLDIERS,
    toInteger(
      territory.battleTarget?.defender?.soldiers,
      toInteger(territory.garrison?.soldiers, toInteger(territory.defense, MIN_BATTLE_SOLDIERS)),
    ),
  );
}

function getDefenderLeader(territory = {}) {
  const leader = battleLeaders.getDefenderLeaderSnapshot(territory);
  if (leader) return leader;
  const profile = BattleConfig.getDefenderProfileForOwner(territory.owner, territory.naturalName);
  return {
    id: `df_${territory.id || 'site'}`,
    name: profile.name || territory.naturalName || 'Defender',
    title: 'Defender',
    quality: 'common',
    qualityLabel: '',
    level: 1,
    attributes: normalizeAttributes(profile),
    appearance: {},
    abilityKit: null,
    skills: [],
  };
}

function buildDefenderGenerals(territory = {}) {
  const leader = getDefenderLeader(territory);
  return [{
    gid: String(leader.id || `df_${territory.id || 'site'}`),
    attributes: clone(leader.attributes || {}),
    soldiers: getDefenderSoldiers(territory),
    leader,
  }];
}

function getSurvivorCount(result = {}, gid = '') {
  return Math.max(0, toInteger(result.survivorsByGid?.[String(gid)], 0));
}

function createExperienceSummary(attackerStart, attackerEnd, defenderStart, defenderEnd, success) {
  const enemyLoss = Math.max(0, defenderStart - defenderEnd);
  const ownLoss = Math.max(0, attackerStart - attackerEnd);
  const victoryBonus = success ? Math.max(20, Math.round(defenderStart * 0.05)) : 0;
  return {
    total: Math.max(0, Math.round(enemyLoss + ownLoss * 0.25 + victoryBonus)),
    enemyLoss,
    ownLoss,
    victoryBonus,
    formula: 'enemyLoss + ownLoss * 0.25 + victoryBonus',
  };
}

function buildReport({
  mission = {},
  territory = {},
  attacker = {},
  defenderGeneral = {},
  battle = {},
  now = new Date(),
} = {}) {
  const result = battle.result || {};
  const attackerStart = Math.max(0, toInteger(attacker.snapshot?.soldiersCommitted, 0));
  const attackerEnd = Math.max(0, toInteger(battle.attackerSnapshot?.soldiersRemaining, 0));
  const defenderStart = Math.max(0, toInteger(defenderGeneral.soldiers, 0));
  const defenderEnd = getSurvivorCount(result, defenderGeneral.gid);
  const success = battle.winner === 'attacker';
  const experience = createExperienceSummary(attackerStart, attackerEnd, defenderStart, defenderEnd, success);
  const leader = attacker.leader || {};
  const defenderLeader = defenderGeneral.leader || {};
  return {
    id: `battle_${territory.id || 'territory'}_${getNowMs(now)}`,
    mode: 'entity-battle',
    result: success ? 'victory' : 'defeat',
    summary: success
      ? `${leader.name || 'Field Commander'} secured ${territory.naturalName || territory.id || 'the site'}.`
      : `${leader.name || 'Field Commander'} was forced back by ${territory.naturalName || territory.id || 'the site'}.`,
    system: BattleSimService.SCHEMA,
    battleTarget: mission.battleTarget ? clone(mission.battleTarget) : null,
    groupSize: DEFAULT_SOLDIER_SCALE,
    rounds: [],
    turns: [],
    detailEvents: [],
    experience,
    attacker: {
      leaderId: leader.id || mission.expedition?.leader || 'unavailable',
      leaderName: leader.name || 'Field Commander',
      leaderTitle: leader.title || '',
      quality: leader.quality || '',
      level: toInteger(leader.level, 1),
      attributes: clone(leader.attributes || {}),
      soldiersStart: attackerStart,
      soldiersEnd: attackerEnd,
      groupsStart: getBattleVisualGroups(attackerStart, DEFAULT_SOLDIER_SCALE),
      groupsEnd: getBattleVisualGroups(attackerEnd, DEFAULT_SOLDIER_SCALE),
      appearance: clone(leader.appearance || {}),
    },
    defender: {
      leaderId: defenderLeader.id || '',
      leaderName: defenderLeader.name || territory.naturalName || 'Defender',
      leaderTitle: defenderLeader.title || 'Defender',
      quality: defenderLeader.quality || '',
      qualityLabel: defenderLeader.qualityLabel || '',
      level: toInteger(defenderLeader.level, 1),
      attributes: clone(defenderLeader.attributes || {}),
      soldiersStart: defenderStart,
      soldiersEnd: success ? 0 : defenderEnd,
      groupsStart: getBattleVisualGroups(defenderStart, DEFAULT_SOLDIER_SCALE),
      groupsEnd: getBattleVisualGroups(success ? 0 : defenderEnd, DEFAULT_SOLDIER_SCALE),
      appearance: clone(defenderLeader.appearance || {}),
    },
    visual: {
      groupSize: DEFAULT_SOLDIER_SCALE,
      map: battleReports.getBattleStageForTerritory(territory),
    },
    simulation: clone(result),
    replay: {
      setup: clone(battle.setup || null),
      inputStream: clone(battle.inputStream || []),
    },
  };
}

function resolveConquestBattle(gameState = {}, mission = {}, territory = {}, now = new Date()) {
  const targetTerritory = mission.battleTarget
    ? { ...territory, battleTarget: mission.battleTarget }
    : territory;
  const attacker = buildAttackerSnapshot(gameState, mission, now);
  const defenderGenerals = buildDefenderGenerals(targetTerritory);
  const battle = BattleSimService.resolveBattle({
    seed: getNowMs(now) + String(mission.id || territory.id || '').length,
    attacker: {
      snapshot: attacker.snapshot,
      attributesByPersonId: attacker.attributesByPersonId,
    },
    defender: {
      generals: defenderGenerals.map((general) => ({
        gid: general.gid,
        attributes: general.attributes,
        soldiers: general.soldiers,
      })),
    },
    inputStream: DEFAULT_INPUT_STREAM.map((entry) => ({ ...entry })),
  });
  const report = buildReport({
    mission,
    territory: targetTerritory,
    attacker,
    defenderGeneral: defenderGenerals[0],
    battle,
    now,
  });
  return {
    success: battle.winner === 'attacker',
    casualties: Math.max(0, toInteger(attacker.snapshot.soldiersCommitted, 0) - toInteger(battle.attackerSnapshot?.soldiersRemaining, 0)),
    experience: report.experience,
    report,
  };
}

module.exports = {
  DEFAULT_INPUT_STREAM,
  buildAttackerSnapshot,
  buildDefenderGenerals,
  buildReport,
  createExperienceSummary,
  resolveConquestBattle,
};
