'use strict';

// Published migrations are append-only. Do not edit this definition after release;
// add a new migration id for every future schema change.
const COMMAND_RECEIPTS_MIGRATION = Object.freeze({
  id: '008-create-command-receipts',
  description: 'Create the expand-phase shadow command receipt ledger.',
  statements: Object.freeze([
    `CREATE TABLE IF NOT EXISTS command_receipts (
      command_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      session_id TEXT NOT NULL,
      client_seq INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN (
        'accepted', 'in_progress', 'terminal_success', 'terminal_failed'
      )),
      result_json TEXT,
      plan_attempt INTEGER NOT NULL DEFAULT 0,
      admission_credential_version INTEGER NOT NULL,
      admission_session_epoch INTEGER NOT NULL,
      admission_authz_epoch INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (command_id),
      UNIQUE (session_id, client_seq),
      UNIQUE (command_id)
    )`,
  ]),
});

module.exports = { COMMAND_RECEIPTS_MIGRATION };
