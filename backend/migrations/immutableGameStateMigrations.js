'use strict';

// Published migration definitions are append-only. Their checksums are stored in
// deployed databases, so even wording changes must use a new migration id.
const GAME_STATE_COMPAT_COLUMNS = Object.freeze([
  ['revision', 'revision INTEGER DEFAULT 0'],
  ['tutorial', 'tutorial TEXT'],
  ['saveMetadata', 'saveMetadata TEXT'],
  ['softGuideState', 'softGuideState TEXT'],
  ['talentPolicies', 'talentPolicies TEXT'],
  ['famousPeople', 'famousPeople TEXT'],
  ['famousPersonState', 'famousPersonState TEXT'],
  ['taskProgress', 'taskProgress TEXT'],
  ['military', 'military TEXT'],
  ['regularEventState', 'regularEventState TEXT'],
  ['activeBuffs', 'activeBuffs TEXT'],
  ['threatEventState', 'threatEventState TEXT'],
  ['polity', 'polity TEXT'],
  ['territories', 'territories TEXT'],
  ['worldMap', 'worldMap TEXT'],
  ['worldCombat', 'worldCombat TEXT'],
  ['activeCityId', 'activeCityId TEXT'],
  ['cities', 'cities TEXT'],
  ['scoutedCoordinates', 'scoutedCoordinates TEXT'],
  ['scoutState', 'scoutState TEXT'],
  ['exploreMissions', 'exploreMissions TEXT'],
  ['worldMarchClientReports', 'worldMarchClientReports TEXT'],
  ['worldMarchVerification', 'worldMarchVerification TEXT'],
  ['worldAi', 'worldAi TEXT'],
  ['warMissions', 'warMissions TEXT'],
  ['scoutReports', 'scoutReports TEXT'],
]);

const GAME_STATE_BASELINE_MIGRATION = Object.freeze({
  id: '001-game-states-compat-columns',
  description: 'Backfill compatibility columns that predate the schema_migrations ledger.',
  statements: GAME_STATE_COMPAT_COLUMNS.map(([, definition]) => `ALTER TABLE game_states ADD COLUMN ${definition}`),
  apply(db) {
    const columns = new Set(db.prepare('PRAGMA table_info(game_states)').all().map((column) => column.name));
    for (const [name, definition] of GAME_STATE_COMPAT_COLUMNS) {
      if (!columns.has(name)) {
        db.prepare(`ALTER TABLE game_states ADD COLUMN ${definition}`).run();
      }
    }
  },
});

const TASK_REWARD_GRANTS_MIGRATION = Object.freeze({
  id: '005-task-reward-grants-column',
  description: 'Add task reward grant ledger column for non-tutorial reward claims.',
  statements: ['ALTER TABLE game_states ADD COLUMN taskRewardGrants TEXT'],
  apply(db) {
    const columns = new Set(db.prepare('PRAGMA table_info(game_states)').all().map((column) => column.name));
    if (!columns.has('taskRewardGrants')) {
      db.prepare('ALTER TABLE game_states ADD COLUMN taskRewardGrants TEXT').run();
    }
  },
});

module.exports = {
  GAME_STATE_BASELINE_MIGRATION,
  TASK_REWARD_GRANTS_MIGRATION,
};
