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

function collectStableIndexEntries(indexText) {
  const entries = [];
  const lines = indexText.split(/\r?\n/);
  let currentPath = null;
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^### `([^`]+)`/.exec(lines[index]);
    if (heading) currentPath = normalizePath(heading[1]);
    const status = /状态 \/ Status:\s*(.+)$/.exec(lines[index]);
    if (currentPath && status && status[1].trim().startsWith('stable')) {
      entries.push({ path: currentPath, status: status[1].trim(), line: index + 1 });
    }
  }
  return entries;
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
  const stableIndexEntries = collectStableIndexEntries(responsibilityIndex);
  const missingManifestEntries = stableIndexEntries
    .filter((entry) => !stableFiles.has(entry.path))
    .map((entry) => `${entry.path}:${entry.line} (${entry.status})`);
  assert(
    missingManifestEntries.length === 0,
    `Stable responsibility-index entries must be listed in stable block manifest:\n${missingManifestEntries.join('\n')}`,
  );

  checkStableReopenPolicy(manifest, stableFiles);

  console.log('[stable-blocks] passed');
}

main();
