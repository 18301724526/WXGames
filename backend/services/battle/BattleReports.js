const {
  toInteger,
} = require('./BattleShared');

function createBattleReports({
  BattleConfig,
  DEFAULT_SOLDIER_SCALE,
} = {}) {
  function getBattleMapForTerritory(territory = {}) {
    return BattleConfig.getBattleMapForType(territory.type);
  }

  function getBattleStageForTerritory(territory = {}) {
    return BattleConfig.getBattleStageForType(territory.type);
  }

  function createConquestSummaryReport(mission = {}, territory = {}, result = {}, now = new Date()) {
    const committed = Math.max(0, toInteger(mission.soldiersCommitted, 0));
    const casualties = Math.max(0, toInteger(result.casualties, 0));
    const defenderStart = Math.max(0, toInteger(territory.defense, 0));
    const success = Boolean(result.success);
    return {
      id: `battle_${territory.id || 'territory'}_${now.getTime()}`,
      mode: 'summary',
      result: success ? 'victory' : 'defeat',
      summary: success
        ? `Expedition secured ${territory.naturalName || territory.id || 'the site'}.`
        : `Expedition failed to secure ${territory.naturalName || territory.id || 'the site'}.`,
      rounds: [],
      turns: [],
      attacker: {
        leaderId: mission.expedition?.leader || 'unavailable',
        leaderName: mission.expedition?.leaderSnapshot?.name || 'Field Commander',
        soldiersStart: committed,
        soldiersEnd: Math.max(0, committed - casualties),
      },
      defender: {
        name: territory.naturalName || 'Defender',
        soldiersStart: defenderStart,
        soldiersEnd: success ? 0 : Math.max(0, defenderStart - Math.floor(committed / 2)),
      },
      visual: {
        groupSize: DEFAULT_SOLDIER_SCALE,
        map: getBattleMapForTerritory(territory),
      },
    };
  }

  return {
    createConquestSummaryReport,
    getBattleMapForTerritory,
    getBattleStageForTerritory,
  };
}

module.exports = {
  createBattleReports,
};
