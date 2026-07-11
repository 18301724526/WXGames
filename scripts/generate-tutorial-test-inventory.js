const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const { buildImportClosure } = require('./step4-debt-catalog/boundary-utils');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEST_ROOTS = Object.freeze(['backend/tests', 'frontend/js', 'shared']);
const DEFAULT_OUTPUT = 'docs/architecture/artifacts/northstar-s2-tutorial-test-inventory.json';
const EXPECTED_COUNTS = Object.freeze({
  total: 143,
  reusable: 95,
  retirementCandidate: 47,
  antiFeature: 1,
});
const ANTI_FEATURE_FILES = new Set([
  'frontend/js/tutorial/TutorialGuideArchitecture.test.js',
]);

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function collectTestFiles(directory, result = []) {
  const absolute = path.join(REPO_ROOT, directory);
  if (!fs.existsSync(absolute)) return result;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = normalizePath(path.join(directory, entry.name));
    if (entry.isDirectory()) collectTestFiles(relative, result);
    else if (entry.isFile() && entry.name.endsWith('.test.js')) result.push(relative);
  }
  return result;
}

function readTutorialIdentifiers(file, cache) {
  if (cache.has(file)) return cache.get(file);
  const absolute = path.join(REPO_ROOT, file);
  if (!fs.existsSync(absolute) || path.extname(file) !== '.js') {
    cache.set(file, []);
    return [];
  }
  const source = fs.readFileSync(absolute, 'utf8');
  const identifiers = Array.from(new Set(
    espree.tokenize(source, { ecmaVersion: 'latest', sourceType: 'script' })
      .filter((token) => token.type === 'Identifier' && /tutorial/i.test(token.value))
      .map((token) => token.value),
  )).sort();
  cache.set(file, identifiers);
  return identifiers;
}

function isIncidentalEcsAssetOnly(file, identifiers) {
  return file.startsWith('frontend/js/ecs/')
    && identifiers.length === 1
    && identifiers[0] === 'tutorial_intro_soldier';
}

function classify(file) {
  if (ANTI_FEATURE_FILES.has(file)) {
    return {
      category: '反特征',
      reason: '锁定 TutorialGuideFlowRegistry 当前实现形态，后续迁移允许改写',
    };
  }
  if (file.startsWith('backend/')) {
    return {
      category: '退役候选',
      reason: "后端教程耦合测试，B3' 删除后按清单 declared 退役",
    };
  }
  return {
    category: '可复用',
    reason: '保留为前端教程行为、投影、渲染或共享契约特征测试',
  };
}

function buildInventory() {
  const identifierCache = new Map();
  const allTestFiles = TEST_ROOTS.flatMap((root) => collectTestFiles(root)).sort();
  const excludedIncidental = [];
  const files = [];

  for (const file of allTestFiles) {
    const closure = buildImportClosure([file], { repoRoot: REPO_ROOT });
    const identifiers = Array.from(new Set(
      closure.flatMap((sourceFile) => readTutorialIdentifiers(sourceFile, identifierCache)),
    )).sort();
    if (!identifiers.length) continue;
    if (isIncidentalEcsAssetOnly(file, identifiers)) {
      excludedIncidental.push(file);
      continue;
    }
    files.push({
      path: file,
      ...classify(file),
      tutorialIdentifiers: identifiers,
    });
  }

  const counts = {
    total: files.length,
    reusable: files.filter((entry) => entry.category === '可复用').length,
    retirementCandidate: files.filter((entry) => entry.category === '退役候选').length,
    antiFeature: files.filter((entry) => entry.category === '反特征').length,
    excludedIncidentalEcsAssetOnly: excludedIncidental.length,
    npmTestUniverse: allTestFiles.length,
  };
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[key] !== expected) {
      throw new Error(`Tutorial test inventory ${key} drift: expected ${expected}, received ${counts[key]}`);
    }
  }

  const universeDigest = crypto.createHash('sha256')
    .update(allTestFiles.map((file) => `${file}\n`).join(''))
    .digest('hex');
  return {
    schema: 'northstar-s2-tutorial-test-inventory/v1',
    enumeration: {
      roots: TEST_ROOTS,
      universe: 'npm test (backend/tests + frontend/js + shared)',
      signal: 'local import closure contains an Identifier token matching /tutorial/i',
      exclusion: 'frontend/js/ecs/*.test.js whose only tutorial identifier is tutorial_intro_soldier',
      universePathSha256: universeDigest,
    },
    counts,
    excludedIncidental,
    files,
  };
}

function writeInventory(output = DEFAULT_OUTPUT) {
  const inventory = buildInventory();
  const absolute = path.resolve(REPO_ROOT, output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(inventory, null, 2)}\n`);
  return { absolute, inventory };
}

if (require.main === module) {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const output = outputArg ? outputArg.slice('--output='.length) : DEFAULT_OUTPUT;
  const result = writeInventory(output);
  console.log(JSON.stringify({
    output: normalizePath(path.relative(REPO_ROOT, result.absolute)),
    ...result.inventory.counts,
  }));
}

module.exports = {
  ANTI_FEATURE_FILES,
  DEFAULT_OUTPUT,
  EXPECTED_COUNTS,
  TEST_ROOTS,
  buildInventory,
  classify,
  isIncidentalEcsAssetOnly,
  writeInventory,
};
