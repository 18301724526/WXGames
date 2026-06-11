#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'docs', 'stable_block_manifest_2026-06-09.json');
const responsibilityIndexPath = path.join(repoRoot, 'docs', 'architecture_module_responsibility_index_2026-06-08.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function getChangedTrackedFiles() {
  const output = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD', '--']);
  return new Set(output ? output.split(/\r?\n/).map(normalizePath) : []);
}

function collectResponsibilityEntries(indexText) {
  const entries = [];
  const lines = indexText.split(/\r?\n/);
  let current = null;
  function flushCurrent() {
    if (current) entries.push(current);
  }
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^### `([^`]+)`/.exec(lines[index]);
    if (heading) {
      flushCurrent();
      current = {
        path: normalizePath(heading[1]),
        status: '',
        line: index + 1,
        lines: [],
      };
      continue;
    }
    if (!current) continue;
    current.lines.push(lines[index]);
    const status = /^(?:[^`]*\/\s*)?Status:\s*(.+)$/.exec(lines[index]);
    if (status) current.status = status[1].trim();
  }
  flushCurrent();
  return entries;
}

function collectStableIndexEntries(indexText) {
  return collectResponsibilityEntries(indexText)
    .filter((entry) => entry.status.startsWith('stable'));
}

function hasAnyLine(entry, patterns) {
  return patterns.some((pattern) => entry.lines.some((line) => pattern.test(line)));
}

function validatePromotionEvidence(block) {
  const evidence = block.promotionEvidence;
  assert(evidence && typeof evidence === 'object', `${block.id}: promotionEvidence is required`);
  assert(evidence.matrixReviewed === true, `${block.id}: promotionEvidence.matrixReviewed must be true`);
  assert(
    Array.isArray(evidence.observationNotes) && evidence.observationNotes.length > 0,
    `${block.id}: promotionEvidence.observationNotes must be non-empty`,
  );
  assert(
    typeof evidence.publicContract === 'string' && evidence.publicContract,
    `${block.id}: promotionEvidence.publicContract is required`,
  );
  assert(
    typeof evidence.extensionPath === 'string' && evidence.extensionPath,
    `${block.id}: promotionEvidence.extensionPath is required`,
  );
  assert(
    typeof evidence.reopenExceptions === 'string' && evidence.reopenExceptions,
    `${block.id}: promotionEvidence.reopenExceptions is required`,
  );
  assert(
    Array.isArray(evidence.regression) && evidence.regression.some((command) => /^(node|npm)\s/.test(command)),
    `${block.id}: promotionEvidence.regression must include at least one node/npm command`,
  );
}

function validateBlock(block, index) {
  assert(block && typeof block === 'object', `stableBlocks[${index}] must be an object`);
  assert(typeof block.id === 'string' && block.id, `stableBlocks[${index}].id is required`);
  assert(block.status === 'stable', `${block.id}: status must be "stable"`);
  assert(typeof block.owner === 'string' && block.owner, `${block.id}: owner is required`);
  assert(Array.isArray(block.files) && block.files.length > 0, `${block.id}: files must be non-empty`);
  assert(Array.isArray(block.stableSurface) && block.stableSurface.length > 0, `${block.id}: stableSurface must be non-empty`);
  assert(Array.isArray(block.extensionPaths) && block.extensionPaths.length > 0, `${block.id}: extensionPaths must be non-empty`);
  assert(Array.isArray(block.allowedReopenReasons) && block.allowedReopenReasons.length > 0, `${block.id}: allowedReopenReasons must be non-empty`);
  validatePromotionEvidence(block);
}

function validateResponsibilityEntry(entry) {
  assert(entry.status.startsWith('stable'), `${entry.path}: responsibility index status must start with stable`);
  assert(
    hasAnyLine(entry, [/Public Contract:/, /Public Command:/]),
    `${entry.path}: stable responsibility entry must document a public contract or command`,
  );
  assert(
    hasAnyLine(entry, [/Extension Path:/]),
    `${entry.path}: stable responsibility entry must document an extension path`,
  );
  assert(
    hasAnyLine(entry, [/Regression:/]),
    `${entry.path}: stable responsibility entry must document regression commands`,
  );
  assert(
    entry.lines.some((line) => /`(node|npm)\s[^`]+`/.test(line) || /^- (node|npm)\s/.test(line)),
    `${entry.path}: stable responsibility entry must include a node/npm regression command`,
  );
}

function checkStableReopenPolicy(manifest, stableFiles) {
  const changedFiles = getChangedTrackedFiles();
  const changedStableFiles = [...stableFiles].filter((file) => changedFiles.has(file));
  if (!changedStableFiles.length) return;

  const allowReopen = process.env[manifest.reopenPolicy?.environmentFlag || 'ALLOW_STABLE_BLOCK_REOPEN'] === '1';
  const reason = process.env[manifest.reopenPolicy?.environmentReason || 'STABLE_BLOCK_REOPEN_REASON'] || '';
  const allowedReasons = new Set(manifest.reopenPolicy?.allowedReasons || []);
  if (allowReopen && allowedReasons.has(reason)) return;

  throw new Error([
    'Stable block internals changed without an approved reopen reason.',
    'Set ALLOW_STABLE_BLOCK_REOPEN=1 and STABLE_BLOCK_REOPEN_REASON=<allowed reason> only for bug/perf/security/contract/governance work.',
    `Changed stable files: ${changedStableFiles.join(', ')}`,
    `Allowed reasons: ${[...allowedReasons].join(', ')}`,
  ].join('\n'));
}

function validateCandidatePromotionQueue(manifest, entriesByPath, stableFiles) {
  assert(
    Array.isArray(manifest.candidatePromotionQueue),
    'manifest.candidatePromotionQueue must be an array',
  );
  manifest.candidatePromotionQueue.map(normalizePath).forEach((candidatePath) => {
    assert(!stableFiles.has(candidatePath), `${candidatePath}: candidatePromotionQueue must not include already stable files`);
    assert(fs.existsSync(path.join(repoRoot, candidatePath)), `candidatePromotionQueue file does not exist: ${candidatePath}`);
    const entry = entriesByPath.get(candidatePath);
    assert(entry, `candidatePromotionQueue file is missing responsibility-index entry: ${candidatePath}`);
    assert(
      entry.status.startsWith('candidate'),
      `${candidatePath}: candidatePromotionQueue entry must still be candidate, got "${entry.status || 'missing'}"`,
    );
  });
}

function main() {
  const manifest = readJson(manifestPath);
  assert(manifest.version === 1, 'manifest.version must be 1');
  assert(Array.isArray(manifest.stableBlocks), 'manifest.stableBlocks must be an array');

  const stableFiles = new Set();
  manifest.stableBlocks.forEach((block, index) => {
    validateBlock(block, index);
    block.files.map(normalizePath).forEach((file) => {
      const fullPath = path.join(repoRoot, file);
      assert(fs.existsSync(fullPath), `${block.id}: stable file does not exist: ${file}`);
      stableFiles.add(file);
    });
  });

  const responsibilityIndex = fs.readFileSync(responsibilityIndexPath, 'utf8');
  const responsibilityEntries = collectResponsibilityEntries(responsibilityIndex);
  const entriesByPath = new Map(responsibilityEntries.map((entry) => [entry.path, entry]));
  const stableIndexEntries = responsibilityEntries.filter((entry) => entry.status.startsWith('stable'));
  const missingManifestEntries = stableIndexEntries
    .filter((entry) => !stableFiles.has(entry.path))
    .map((entry) => `${entry.path}:${entry.line} (${entry.status})`);
  assert(
    missingManifestEntries.length === 0,
    `Stable responsibility-index entries must be listed in stable block manifest:\n${missingManifestEntries.join('\n')}`,
  );
  for (const file of stableFiles) {
    const entry = entriesByPath.get(file);
    assert(entry, `Stable manifest file is missing responsibility-index entry: ${file}`);
    validateResponsibilityEntry(entry);
  }
  validateCandidatePromotionQueue(manifest, entriesByPath, stableFiles);

  checkStableReopenPolicy(manifest, stableFiles);

  console.log('[stable-blocks] passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  collectResponsibilityEntries,
  collectStableIndexEntries,
  validateCandidatePromotionQueue,
  validateBlock,
  validatePromotionEvidence,
  validateResponsibilityEntry,
};
