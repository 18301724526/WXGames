const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkStableReopenPolicy,
  collectResponsibilityEntries,
  collectStableIndexEntries,
  validateCandidatePromotionQueue,
  validateBlock,
  validatePromotionEvidence,
  validateResponsibilityEntry,
} = require('./check-stable-blocks');

function createStableBlock(overrides = {}) {
  return {
    id: 'stable-test-block',
    status: 'stable',
    owner: 'architecture',
    files: ['scripts/check-stable-blocks.js'],
    stableSurface: ['stable manifest validation'],
    extensionPaths: ['add promoted files through the manifest'],
    promotionEvidence: {
      matrixReviewed: true,
      observationNotes: ['stable contract observed through the architecture baseline'],
      publicContract: 'Stable public contract is explicit.',
      extensionPath: 'Future work extends through the manifest metadata.',
      reopenExceptions: 'Only approved reopen reasons are allowed.',
      regression: ['node scripts/check-stable-blocks.js'],
    },
    allowedReopenReasons: ['bug', 'governance-update'],
    ...overrides,
  };
}

test('stable guard collects responsibility entries using ASCII Status anchors', () => {
  const text = [
    '### `frontend/js/ecs/system/Foo.js`',
    '',
    '状态 / Status: candidate',
    '',
    '### `docs/stable.md`',
    '',
    '状态 / Status: stable governance',
    '公开约定 / Public Contract:',
    '- responsibility-index parsing through ASCII `Status:` anchors',
    '- contract',
    '扩展方式 / Extension Path:',
    '- extension',
    '回归 / Regression:',
    '- `node scripts/check-stable-blocks.js`',
  ].join('\n');

  const entries = collectResponsibilityEntries(text);
  assert.deepEqual(entries.map((entry) => [entry.path, entry.status]), [
    ['frontend/js/ecs/system/Foo.js', 'candidate'],
    ['docs/stable.md', 'stable governance'],
  ]);
  assert.deepEqual(collectStableIndexEntries(text).map((entry) => entry.path), ['docs/stable.md']);
});

test('stable block validation requires promotion evidence', () => {
  assert.doesNotThrow(() => validateBlock(createStableBlock(), 0));
  assert.throws(
    () => validateBlock(createStableBlock({ promotionEvidence: undefined }), 0),
    /promotionEvidence is required/,
  );
  assert.throws(
    () => validatePromotionEvidence(createStableBlock({
      promotionEvidence: {
        matrixReviewed: true,
        observationNotes: ['observed'],
        publicContract: 'contract',
        extensionPath: 'extension',
        reopenExceptions: 'exceptions',
        regression: ['bash scripts/check-stable-blocks.sh'],
      },
    })),
    /regression must include at least one node\/npm command/,
  );
});

test('stable responsibility entries require contract, extension path, and regression command', () => {
  const [entry] = collectStableIndexEntries([
    '### `scripts/check-stable-blocks.js`',
    '',
    '状态 / Status: stable governance',
    '',
    '公开命令 / Public Command:',
    '- `node scripts/check-stable-blocks.js`',
    '',
    '扩展方式 / Extension Path:',
    '- Add guard behavior with focused checks.',
    '',
    '回归 / Regression:',
    '- `node --check scripts/check-stable-blocks.js`',
  ].join('\n'));

  assert.doesNotThrow(() => validateResponsibilityEntry(entry));

  const [missingRegression] = collectStableIndexEntries([
    '### `scripts/check-stable-blocks.js`',
    '状态 / Status: stable governance',
    '公开命令 / Public Command:',
    '- `node scripts/check-stable-blocks.js`',
    '扩展方式 / Extension Path:',
    '- Add guard behavior with focused checks.',
  ].join('\n'));

  assert.throws(
    () => validateResponsibilityEntry(missingRegression),
    /must document regression commands/,
  );
});

test('candidate promotion queue keeps files documented as candidate only', () => {
  const entries = collectResponsibilityEntries([
    '### `scripts/check-stable-blocks.js`',
    'Status: stable governance',
    '',
    '### `scripts/check-stable-blocks.test.js`',
    'Status: candidate',
  ].join('\n'));
  const entriesByPath = new Map(entries.map((entry) => [entry.path, entry]));

  assert.doesNotThrow(() => validateCandidatePromotionQueue({
    candidatePromotionQueue: ['scripts/check-stable-blocks.test.js'],
  }, entriesByPath, new Set(['scripts/check-stable-blocks.js'])));

  assert.throws(
    () => validateCandidatePromotionQueue({
      candidatePromotionQueue: ['scripts/check-stable-blocks.js'],
    }, entriesByPath, new Set(['scripts/check-stable-blocks.js'])),
    /must not include already stable files/,
  );

  assert.throws(
    () => validateCandidatePromotionQueue({
      candidatePromotionQueue: ['scripts/check-stable-blocks.js'],
    }, entriesByPath, new Set()),
    /must still be candidate/,
  );
});

test('stable reopen policy skips worktree diff when git metadata is unavailable', () => {
  const manifest = {
    reopenPolicy: {
      allowedReasons: ['bug'],
    },
  };

  assert.doesNotThrow(() => checkStableReopenPolicy(
    manifest,
    new Set(['scripts/check-stable-blocks.js']),
    { changedFiles: null },
  ));
});

test('stable reopen policy still blocks stable-file edits without approved reason', () => {
  const manifest = {
    reopenPolicy: {
      allowedReasons: ['bug', 'governance-update'],
    },
  };
  const stableFiles = new Set(['scripts/check-stable-blocks.js']);
  const changedFiles = new Set(['scripts/check-stable-blocks.js']);

  assert.throws(
    () => checkStableReopenPolicy(manifest, stableFiles, { changedFiles, env: {} }),
    /Stable block internals changed without an approved reopen reason/,
  );
  assert.doesNotThrow(() => checkStableReopenPolicy(manifest, stableFiles, {
    changedFiles,
    env: {
      ALLOW_STABLE_BLOCK_REOPEN: '1',
      STABLE_BLOCK_REOPEN_REASON: 'governance-update',
    },
  }));
});
