const BattleConfig = require('../config/BattleConfig');
const {
  getBattleVisualGroups: getRawBattleVisualGroups,
} = require('./battle/BattleShared');
const {
  createBattleLeaders,
} = require('./battle/BattleLeaders');
const {
  createBattleReports,
} = require('./battle/BattleReports');

const {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
} = BattleConfig;

const battleLeaders = createBattleLeaders({ BattleConfig });
const battleReports = createBattleReports({
  BattleConfig,
  DEFAULT_SOLDIER_SCALE,
});

const getBattleVisualGroups = (soldiers, groupSize = DEFAULT_SOLDIER_SCALE) => (
  getRawBattleVisualGroups(soldiers, groupSize)
);

module.exports = {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  getLeaderSnapshot: battleLeaders.getLeaderSnapshot,
  getDefenderLeaderSnapshot: battleLeaders.getDefenderLeaderSnapshot,
  getBattleVisualGroups,
  getBattleMapForTerritory: battleReports.getBattleMapForTerritory,
  getBattleStageForTerritory: battleReports.getBattleStageForTerritory,
  createConquestSummaryReport: battleReports.createConquestSummaryReport,
};
