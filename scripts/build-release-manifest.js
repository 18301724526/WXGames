'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ConfigPipeline = require('../backend/services/config/ConfigPipeline');
const { COMMAND_SCHEMA } = require('../backend/application/commands/CommandEnvelope');
const {
  RELEASE_MANIFESTS_MIGRATION,
} = require('../backend/migrations/releaseManifestMigration');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MANIFEST_SCHEMA = 'wxgame-release-manifest-v1';
const SIGNATURE_SCHEMA = 'wxgame-release-manifest-signature-v1';
const DIGEST_ALGORITHM = 'sha256';
const DIGEST_INPUT_FORMAT = 'path-byte-length:path:file-byte-length:file-bytes';
const DEFAULT_OUTPUT_PATH = path.join(PROJECT_ROOT, 'tmp', 'm0', 'release-manifest.json');
const EVENT_SCHEMA_FILES = Object.freeze([
  'backend/application/commands/CommandCommitter.js',
  'backend/application/commands/CommandEnvelope.js',
  'backend/services/realtime/AoiSyncSnapshot.js',
  'backend/services/realtime/CommandAuthorityContract.js',
  'backend/services/realtime/ServerTimelineSnapshot.js',
]);

function compareRepoPaths(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function normalizeRepoPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function sha256Hex(bytes) {
  return crypto.createHash(DIGEST_ALGORITHM).update(bytes).digest('hex');
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort(compareRepoPaths)
    .reduce((result, key) => {
      result[key] = sortObject(value[key]);
      return result;
    }, {});
}

function stableJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(sortObject(value), null, 2)}\n`, 'utf8');
}

function listTrackedFiles(projectRoot = PROJECT_ROOT) {
  const raw = execFileSync('git', ['ls-files', '-z', '--cached'], {
    cwd: projectRoot,
    encoding: 'buffer',
    windowsHide: true,
  });
  return raw
    .toString('utf8')
    .split('\0')
    .map(normalizeRepoPath)
    .filter(Boolean)
    .sort(compareRepoPaths);
}

function selectDigestInputs(trackedFiles) {
  const files = [...new Set(trackedFiles.map(normalizeRepoPath))].sort(compareRepoPaths);
  const fileSet = new Set(files);
  const inputs = {
    backend: files.filter((file) => file.startsWith('backend/') || file.startsWith('shared/')),
    frontend: files.filter((file) => file.startsWith('frontend/')),
    config: files.filter((file) => (
      file.startsWith('config/')
      || file.startsWith('backend/config/')
      || file === 'shared/buildingConfig.json'
    )),
    eventSchema: EVENT_SCHEMA_FILES.filter((file) => fileSet.has(file)).sort(compareRepoPaths),
  };
  for (const [scope, scopeFiles] of Object.entries(inputs)) {
    if (scopeFiles.length === 0) throw new Error(`Release manifest digest scope is empty: ${scope}`);
  }
  if (inputs.eventSchema.length !== EVENT_SCHEMA_FILES.length) {
    const missing = EVENT_SCHEMA_FILES.filter((file) => !fileSet.has(file));
    throw new Error(`Release event schema inputs are missing: ${missing.join(', ')}`);
  }
  return inputs;
}

function digestFiles(projectRoot, relativeFiles) {
  const hash = crypto.createHash(DIGEST_ALGORITHM);
  const sortedFiles = [...relativeFiles].map(normalizeRepoPath).sort(compareRepoPaths);
  for (const relativeFile of sortedFiles) {
    const absoluteFile = path.resolve(projectRoot, ...relativeFile.split('/'));
    const relativeCheck = path.relative(projectRoot, absoluteFile);
    if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
      throw new Error(`Release digest input escapes project root: ${relativeFile}`);
    }
    const content = fs.readFileSync(absoluteFile);
    const pathBytes = Buffer.from(relativeFile, 'utf8');
    hash.update(Buffer.from(`${pathBytes.length}:`, 'ascii'));
    hash.update(pathBytes);
    hash.update(Buffer.from(`:${content.length}:`, 'ascii'));
    hash.update(content);
  }
  return hash.digest('hex');
}

function collectRulesetIds(options = {}) {
  if (Array.isArray(options.rulesetIds)) {
    return [...new Set(options.rulesetIds.map(String).filter(Boolean))].sort(compareRepoPaths);
  }
  const reports = ConfigPipeline.collectRegistryReports({ repoRoot: options.projectRoot || PROJECT_ROOT });
  const failures = reports.filter((report) => report.validation?.success !== true);
  if (failures.length > 0) {
    throw new Error(`Config registry validation failed: ${failures.map((item) => item.id).join(', ')}`);
  }
  return [...new Set(reports.map((report) => String(report.id || '')).filter(Boolean))]
    .sort(compareRepoPaths);
}

function validateManifest(manifest) {
  if (!manifest || manifest.schema !== MANIFEST_SCHEMA) {
    throw new Error(`Unsupported release manifest schema: ${manifest?.schema || 'missing'}`);
  }
  if (manifest.digestAlgorithm !== DIGEST_ALGORITHM) {
    throw new Error(`Unsupported release manifest digest algorithm: ${manifest.digestAlgorithm}`);
  }
  for (const field of ['backendDigest', 'frontendDigest', 'configDigest', 'eventSchemaDigest']) {
    if (!/^[a-f0-9]{64}$/.test(String(manifest[field] || ''))) {
      throw new Error(`Release manifest field ${field} must be a sha256 hex digest`);
    }
  }
  for (const field of ['databaseSchemaVersion', 'protocolVersion']) {
    if (!String(manifest[field] || '').trim()) {
      throw new Error(`Release manifest field ${field} is required`);
    }
  }
  if (!Array.isArray(manifest.rulesetIds) || manifest.rulesetIds.length === 0) {
    throw new Error('Release manifest rulesetIds must be a non-empty array');
  }
  const sortedRulesets = [...new Set(manifest.rulesetIds)].sort(compareRepoPaths);
  if (JSON.stringify(sortedRulesets) !== JSON.stringify(manifest.rulesetIds)) {
    throw new Error('Release manifest rulesetIds must be unique and byte-sorted');
  }
  for (const scope of ['backend', 'frontend', 'config', 'eventSchema']) {
    const scopeFiles = manifest.digestInputs?.[scope];
    if (!Array.isArray(scopeFiles) || scopeFiles.length === 0) {
      throw new Error(`Release manifest digestInputs.${scope} must be a non-empty array`);
    }
    const sorted = [...new Set(scopeFiles)].sort(compareRepoPaths);
    if (JSON.stringify(sorted) !== JSON.stringify(scopeFiles)) {
      throw new Error(`Release manifest digestInputs.${scope} must be unique and byte-sorted`);
    }
  }
  return manifest;
}

function createReleaseManifest(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const trackedFiles = options.trackedFiles || listTrackedFiles(projectRoot);
  const digestInputs = selectDigestInputs(trackedFiles);
  const manifest = {
    schema: MANIFEST_SCHEMA,
    digestAlgorithm: DIGEST_ALGORITHM,
    digestInputFormat: DIGEST_INPUT_FORMAT,
    backendDigest: digestFiles(projectRoot, digestInputs.backend),
    frontendDigest: digestFiles(projectRoot, digestInputs.frontend),
    configDigest: digestFiles(projectRoot, digestInputs.config),
    databaseSchemaVersion: options.databaseSchemaVersion || RELEASE_MANIFESTS_MIGRATION.id,
    protocolVersion: options.protocolVersion || COMMAND_SCHEMA,
    eventSchemaDigest: digestFiles(projectRoot, digestInputs.eventSchema),
    rulesetIds: collectRulesetIds({ ...options, projectRoot }),
    digestInputs,
  };
  return validateManifest(manifest);
}

function isWithinRoot(candidatePath, rootPath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveExternalKeyPath(keyPath, projectRoot, label) {
  if (!keyPath) throw new Error(`${label} path is required`);
  const resolved = path.resolve(keyPath);
  if (isWithinRoot(resolved, path.resolve(projectRoot))) {
    throw new Error(`${label} must be outside the project runtime directory`);
  }
  if (!fs.statSync(resolved).isFile()) throw new Error(`${label} is not a file: ${resolved}`);
  return resolved;
}

function getPublicKeyId(keyObject) {
  const publicKey = keyObject.type === 'public' ? keyObject : crypto.createPublicKey(keyObject);
  const publicDer = publicKey.export({ format: 'der', type: 'spki' });
  return `ed25519:${sha256Hex(publicDer).slice(0, 16)}`;
}

function defaultSignaturePath(manifestPath) {
  return manifestPath.toLowerCase().endsWith('.json')
    ? `${manifestPath.slice(0, -5)}.signature.json`
    : `${manifestPath}.signature.json`;
}

function buildSignedReleaseManifest(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const signingKeyPath = resolveExternalKeyPath(
    options.signingKeyPath || process.env.M0_RELEASE_SIGNING_KEY_PATH,
    projectRoot,
    'Release signing key',
  );
  const privateKey = crypto.createPrivateKey(fs.readFileSync(signingKeyPath));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`Release signing key must be ed25519, got ${privateKey.asymmetricKeyType || 'unknown'}`);
  }

  const manifest = createReleaseManifest({ ...options, projectRoot });
  const manifestBytes = stableJsonBytes(manifest);
  const manifestDigest = sha256Hex(manifestBytes);
  const signerKeyId = String(
    options.signerKeyId || process.env.M0_RELEASE_SIGNER_KEY_ID || getPublicKeyId(privateKey),
  ).trim();
  if (!signerKeyId) throw new Error('Release signer key id is required');
  const signatureDocument = {
    schema: SIGNATURE_SCHEMA,
    manifestDigest,
    signatureAlgorithm: 'ed25519',
    signerKeyId,
    signature: crypto.sign(null, manifestBytes, privateKey).toString('base64'),
  };

  const outputPath = path.resolve(options.outputPath || DEFAULT_OUTPUT_PATH);
  const signaturePath = path.resolve(options.signaturePath || defaultSignaturePath(outputPath));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(signaturePath), { recursive: true });
  fs.writeFileSync(outputPath, manifestBytes);
  fs.writeFileSync(signaturePath, stableJsonBytes(signatureDocument));
  return { manifest, manifestDigest, outputPath, signatureDocument, signaturePath };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = buildSignedReleaseManifest({
    projectRoot: args['project-root'],
    outputPath: args.output,
    signaturePath: args['signature-output'],
    signingKeyPath: args['signing-key'],
    signerKeyId: args['signer-key-id'],
  });
  console.log(JSON.stringify({
    schema: SIGNATURE_SCHEMA,
    manifestDigest: result.manifestDigest,
    manifestPath: result.outputPath,
    signaturePath: result.signaturePath,
    signerKeyId: result.signatureDocument.signerKeyId,
  }));
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`[release-manifest:build] FAILED ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_OUTPUT_PATH,
  DIGEST_INPUT_FORMAT,
  EVENT_SCHEMA_FILES,
  MANIFEST_SCHEMA,
  PROJECT_ROOT,
  SIGNATURE_SCHEMA,
  buildSignedReleaseManifest,
  collectRulesetIds,
  compareRepoPaths,
  createReleaseManifest,
  defaultSignaturePath,
  digestFiles,
  getPublicKeyId,
  listTrackedFiles,
  parseArgs,
  resolveExternalKeyPath,
  runCli,
  selectDigestInputs,
  sha256Hex,
  stableJsonBytes,
  validateManifest,
};
