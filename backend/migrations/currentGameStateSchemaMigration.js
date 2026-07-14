'use strict';

const CURRENT_GAME_STATE_COLUMNS = Object.freeze([
  Object.freeze(['playerId', 'TEXT PRIMARY KEY']),
  Object.freeze(['revision', 'INTEGER DEFAULT 0']),
  Object.freeze(['saveMetadata', 'TEXT']),
  Object.freeze(['resources', 'TEXT']),
  Object.freeze(['buildings', 'TEXT']),
  Object.freeze(['population', 'TEXT']),
  Object.freeze(['techs', 'TEXT']),
  Object.freeze(['techEffects', 'TEXT']),
  Object.freeze(['currentEra', 'INTEGER']),
  Object.freeze(['eraHistory', 'TEXT']),
  Object.freeze(['happiness', 'INTEGER']),
  Object.freeze(['gameDay', 'INTEGER']),
  Object.freeze(['eventQueue', 'TEXT']),
  Object.freeze(['eventHistory', 'TEXT']),
  Object.freeze(['captureDecisions', 'TEXT']),
  Object.freeze(['regularEventState', 'TEXT']),
  Object.freeze(['threatEventState', 'TEXT']),
  Object.freeze(['activeBuffs', 'TEXT']),
  Object.freeze(['offlineSnapshot', 'TEXT']),
  Object.freeze(['offlineEventLog', 'TEXT']),
  Object.freeze(['negativeStreak', 'INTEGER']),
  Object.freeze(['lastEventAt', 'TEXT']),
  Object.freeze(['talentPolicies', 'TEXT']),
  Object.freeze(['famousPeople', 'TEXT']),
  Object.freeze(['famousPersonState', 'TEXT']),
  Object.freeze(['taskProgress', 'TEXT']),
  Object.freeze(['taskRewardGrants', 'TEXT']),
  Object.freeze(['military', 'TEXT']),
  Object.freeze(['polity', 'TEXT']),
  Object.freeze(['territories', 'TEXT']),
  Object.freeze(['worldMap', 'TEXT']),
  Object.freeze(['activeCityId', 'TEXT']),
  Object.freeze(['cities', 'TEXT']),
  Object.freeze(['scoutedCoordinates', 'TEXT']),
  Object.freeze(['scoutState', 'TEXT']),
  Object.freeze(['exploreMissions', 'TEXT']),
  Object.freeze(['worldMarchClientReports', 'TEXT']),
  Object.freeze(['worldMarchVerification', 'TEXT']),
  Object.freeze(['worldCombat', 'TEXT']),
  Object.freeze(['worldAi', 'TEXT']),
  Object.freeze(['warMissions', 'TEXT']),
  Object.freeze(['scoutReports', 'TEXT']),
  Object.freeze(['updatedAt', 'TEXT']),
]);

const CURRENT_GAME_STATE_COLUMN_NAMES = Object.freeze(
  CURRENT_GAME_STATE_COLUMNS.map(([name]) => name),
);
const REBUILD_TABLE_NAME = 'game_states_rebuild_006';
const columnDefinitions = CURRENT_GAME_STATE_COLUMNS
  .map(([name, definition]) => `${name} ${definition}`)
  .join(', ');
const columnList = CURRENT_GAME_STATE_COLUMN_NAMES.join(', ');

const CURRENT_GAME_STATE_SCHEMA_MIGRATION = Object.freeze({
  id: '006-rebuild-game-states-current-schema',
  description: 'Rebuild game_states with the current canonical column set.',
  statements: Object.freeze([
    `DROP TABLE IF EXISTS ${REBUILD_TABLE_NAME}`,
    `CREATE TABLE ${REBUILD_TABLE_NAME} (${columnDefinitions})`,
    `INSERT INTO ${REBUILD_TABLE_NAME} (${columnList}) SELECT ${columnList} FROM game_states`,
    'DROP TABLE game_states',
    `ALTER TABLE ${REBUILD_TABLE_NAME} RENAME TO game_states`,
  ]),
});

module.exports = {
  CURRENT_GAME_STATE_COLUMNS,
  CURRENT_GAME_STATE_COLUMN_NAMES,
  CURRENT_GAME_STATE_SCHEMA_MIGRATION,
};
