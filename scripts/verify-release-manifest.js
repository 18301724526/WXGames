'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROJECT_ROOT,
  SIGNATURE_SCHEMA,
  defaultSignaturePath,
  getPublicKeyId,
  parseArgs,
  resolveExternalKeyPath,
  sha256Hex,
  validateManifest,
} = require('./build-release-manifest');

function readJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function decodeSignature(value) {
  const text = String(value || '');
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    throw new Error('Release manifest signature is not valid base64');
  }
  const bytes = Buffer.from(text, 'base64');
  if (bytes.toString('base64') !== text) {
    throw new Error('Release manifest signature is not canonical base64');
  }
  return bytes;
}

function validateSignatureDocument(document) {
  if (!document || document.schema !== SIGNATURE_SCHEMA) {
    throw new Error(`Unsupported release signature schema: ${document?.schema || 'missing'}`);
  }
  if (document.signatureAlgorithm !== 'ed25519') {
    throw new Error(`Unsupported release signature algorithm: ${document.signatureAlgorithm || 'missing'}`);
  }
  if (!/^[a-f0-9]{64}$/.test(String(document.manifestDigest || ''))) {
    throw new Error('Release signature manifestDigest must be a sha256 hex digest');
  }
  if (!String(document.signerKeyId || '').trim()) {
    throw new Error('Release signature signerKeyId is required');
  }
  decodeSignature(document.signature);
  return document;
}

function verifyReleaseManifest(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const manifestPath = path.resolve(options.manifestPath || '');
  if (!options.manifestPath) throw new Error('Release manifest path is required');
  const signaturePath = path.resolve(options.signaturePath || defaultSignaturePath(manifestPath));
  const trustRootPath = resolveExternalKeyPath(
    options.trustRootPath || process.env.M0_RELEASE_TRUST_ROOT_PATH,
    projectRoot,
    'Release trust root',
  );

  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = validateManifest(readJson(manifestBytes, 'Release manifest'));
  const signatureDocument = validateSignatureDocument(
    readJson(fs.readFileSync(signaturePath), 'Release signature document'),
  );
  const manifestDigest = sha256Hex(manifestBytes);
  if (manifestDigest !== signatureDocument.manifestDigest) {
    throw new Error(
      `Release manifest digest mismatch: expected ${signatureDocument.manifestDigest}, got ${manifestDigest}`,
    );
  }

  const publicKey = crypto.createPublicKey(fs.readFileSync(trustRootPath));
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`Release trust root must be ed25519, got ${publicKey.asymmetricKeyType || 'unknown'}`);
  }
  const expectedSignerKeyId = String(
    options.signerKeyId || process.env.M0_RELEASE_SIGNER_KEY_ID || '',
  ).trim();
  if (expectedSignerKeyId && signatureDocument.signerKeyId !== expectedSignerKeyId) {
    throw new Error(
      `Release signer key id mismatch: expected ${expectedSignerKeyId}, got ${signatureDocument.signerKeyId}`,
    );
  }
  if (!expectedSignerKeyId && signatureDocument.signerKeyId !== getPublicKeyId(publicKey)) {
    throw new Error(
      `Release signer key id does not match trust root: ${signatureDocument.signerKeyId}`,
    );
  }
  const verified = crypto.verify(
    null,
    manifestBytes,
    publicKey,
    decodeSignature(signatureDocument.signature),
  );
  if (!verified) throw new Error('Release manifest signature verification failed');

  return {
    manifest,
    manifestDigest,
    manifestPath,
    signaturePath,
    signerKeyId: signatureDocument.signerKeyId,
    verified: true,
  };
}

function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = verifyReleaseManifest({
    projectRoot: args['project-root'],
    manifestPath: args.manifest,
    signaturePath: args.signature,
    trustRootPath: args['trust-root'],
    signerKeyId: args['signer-key-id'],
  });
  console.log(JSON.stringify({
    schema: SIGNATURE_SCHEMA,
    manifestDigest: result.manifestDigest,
    signerKeyId: result.signerKeyId,
    verified: result.verified,
  }));
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`[release-manifest:verify] FAILED ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  decodeSignature,
  readJson,
  runCli,
  validateSignatureDocument,
  verifyReleaseManifest,
};
