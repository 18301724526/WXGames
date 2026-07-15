'use strict';

// Published migrations are append-only. Do not edit this definition after release;
// add a new migration id for every future schema change.
const RELEASE_MANIFESTS_MIGRATION = Object.freeze({
  id: '007-create-release-manifests',
  description: 'Create the append-only signed release manifest ledger.',
  statements: Object.freeze([
    `CREATE TABLE IF NOT EXISTS release_manifests (
      manifest_digest TEXT PRIMARY KEY NOT NULL CHECK (length(manifest_digest) = 64),
      manifest_json TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer_key_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_release_manifests_created_at ON release_manifests(created_at)',
    `CREATE TRIGGER IF NOT EXISTS release_manifests_reject_update
      BEFORE UPDATE ON release_manifests
      BEGIN
        SELECT RAISE(ABORT, 'release_manifests is append-only');
      END`,
    `CREATE TRIGGER IF NOT EXISTS release_manifests_reject_delete
      BEFORE DELETE ON release_manifests
      BEGIN
        SELECT RAISE(ABORT, 'release_manifests is append-only');
      END`,
  ]),
});

module.exports = { RELEASE_MANIFESTS_MIGRATION };
