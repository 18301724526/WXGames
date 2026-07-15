'use strict';

// Published migrations are append-only. Do not edit this definition after release;
// add a new migration id for every future schema change.
const COMMAND_EXECUTION_PLANS_MIGRATION = Object.freeze({
  id: '009-create-command-execution-plans',
  description: 'Create the expand-phase immutable command execution plan ledger.',
  statements: Object.freeze([
    `CREATE TABLE IF NOT EXISTS command_execution_plans (
      command_id TEXT NOT NULL,
      plan_attempt INTEGER NOT NULL,
      owner_set_json TEXT NOT NULL,
      owner_set_hash TEXT NOT NULL,
      expected_version_source TEXT NOT NULL,
      superseded_by INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE (command_id, plan_attempt)
    )`,
  ]),
});

module.exports = { COMMAND_EXECUTION_PLANS_MIGRATION };
