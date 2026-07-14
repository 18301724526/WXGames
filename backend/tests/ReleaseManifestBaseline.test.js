'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const {
  RELEASE_MANIFESTS_MIGRATION,
} = require('../migrations/releaseManifestMigration');
const { normalizeMigration } = require('../services/SchemaMigrationService');
const {
  PROJECT_ROOT,
  buildSignedReleaseManifest,
  resolveExternalKeyPath,
} = require('../../scripts/build-release-manifest');
const {
  verifyReleaseManifest,
} = require('../../scripts/verify-release-manifest');

function createExternalTrustRoot() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-m0-release-root-'));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privateKeyPath = path.join(directory, 'release-signing-key.pem');
  const publicKeyPath = path.join(directory, 'release-trust-root.pem');
  fs.writeFileSync(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  fs.writeFileSync(publicKeyPath, publicKey.export({ format: 'pem', type: 'spki' }));
  return { directory, privateKeyPath, publicKeyPath };
}

test('release manifest build is byte-deterministic and verifies against the external trust root', () => {
  const trustRoot = createExternalTrustRoot();
  try {
    const first = buildSignedReleaseManifest({
      outputPath: path.join(trustRoot.directory, 'first.json'),
      signingKeyPath: trustRoot.privateKeyPath,
    });
    const second = buildSignedReleaseManifest({
      outputPath: path.join(trustRoot.directory, 'second.json'),
      signingKeyPath: trustRoot.privateKeyPath,
    });

    assert.deepEqual(fs.readFileSync(first.outputPath), fs.readFileSync(second.outputPath));
    assert.deepEqual(fs.readFileSync(first.signaturePath), fs.readFileSync(second.signaturePath));
    assert.equal(first.manifestDigest, second.manifestDigest);
    assert.equal(first.manifest.databaseSchemaVersion, RELEASE_MANIFESTS_MIGRATION.id);
    assert.equal(first.manifest.protocolVersion, 'game-command-v1');
    assert.equal(first.manifest.rulesetIds.length, 6);

    const verification = verifyReleaseManifest({
      manifestPath: first.outputPath,
      signaturePath: first.signaturePath,
      trustRootPath: trustRoot.publicKeyPath,
    });
    assert.equal(verification.verified, true);
    assert.equal(verification.manifestDigest, first.manifestDigest);
  } finally {
    fs.rmSync(trustRoot.directory, { force: true, recursive: true });
  }
});

test('verifier exits non-zero after any signed manifest byte is changed', () => {
  const trustRoot = createExternalTrustRoot();
  try {
    const built = buildSignedReleaseManifest({
      outputPath: path.join(trustRoot.directory, 'original.json'),
      signingKeyPath: trustRoot.privateKeyPath,
    });
    const original = fs.readFileSync(built.outputPath);
    const digestBytes = Buffer.from(built.manifest.backendDigest, 'ascii');
    const digestOffset = original.indexOf(digestBytes);
    assert.ok(digestOffset >= 0);
    const mutated = Buffer.from(original);
    mutated[digestOffset] = mutated[digestOffset] === 0x61 ? 0x62 : 0x61;
    const mutatedPath = path.join(trustRoot.directory, 'mutated.json');
    fs.writeFileSync(mutatedPath, mutated);

    const result = spawnSync(process.execPath, [
      path.join(PROJECT_ROOT, 'scripts', 'verify-release-manifest.js'),
      '--manifest', mutatedPath,
      '--signature', built.signaturePath,
      '--trust-root', trustRoot.publicKeyPath,
    ], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /digest mismatch|verification failed/);
  } finally {
    fs.rmSync(trustRoot.directory, { force: true, recursive: true });
  }
});

test('signing and trust-root keys inside the runtime directory are rejected', () => {
  assert.throws(
    () => resolveExternalKeyPath(path.join(PROJECT_ROOT, 'package.json'), PROJECT_ROOT, 'test key'),
    /outside the project runtime directory/,
  );
});

test('release manifest migration checksum is fixed and its ledger is append-only', () => {
  const normalizedMigration = normalizeMigration(RELEASE_MANIFESTS_MIGRATION);
  assert.equal(normalizedMigration.id, '007-create-release-manifests');
  assert.equal(normalizedMigration.checksum, '2ced01d6be9aef3c');

  const db = new Database(':memory:');
  try {
    new GameStateRepository(db).init();
    const migrationRow = db.prepare(
      'SELECT checksum, status FROM schema_migrations WHERE id = ?',
    ).get(RELEASE_MANIFESTS_MIGRATION.id);
    assert.deepEqual(migrationRow, { checksum: '2ced01d6be9aef3c', status: 'applied' });

    const insert = db.prepare(`
      INSERT INTO release_manifests (
        manifest_digest, manifest_json, signature, signer_key_id, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    insert.run('a'.repeat(64), '{}', 'signature-a', 'key-a', '2026-07-15T00:00:00.000Z');
    insert.run('b'.repeat(64), '{}', 'signature-b', 'key-b', '2026-07-15T00:00:01.000Z');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM release_manifests').get().count, 2);
    assert.throws(
      () => db.prepare('UPDATE release_manifests SET signature = ? WHERE manifest_digest = ?')
        .run('changed', 'a'.repeat(64)),
      /append-only/,
    );
    assert.throws(
      () => db.prepare('DELETE FROM release_manifests WHERE manifest_digest = ?')
        .run('a'.repeat(64)),
      /append-only/,
    );
  } finally {
    db.close();
  }
});
