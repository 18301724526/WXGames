const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const TEST_SCOPES = Object.freeze({
  backend: ['backend/tests'],
  frontend: ['frontend/js'],
  all: ['backend/tests', 'frontend/js', 'shared'],
});

function collectTestFiles(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, result);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      result.push(fullPath);
    }
  }
  return result;
}

function normalizeScope(value) {
  const scope = String(value || 'all').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TEST_SCOPES, scope) ? scope : 'all';
}

function getTestFiles(scope) {
  return TEST_SCOPES[scope]
    .flatMap((relativeDir) => collectTestFiles(path.join(projectRoot, relativeDir)))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.relative(projectRoot, file));
}

const scope = normalizeScope(process.argv[2]);
const files = getTestFiles(scope);

if (!files.length) {
  console.error(`[test] No ${scope} test files found.`);
  process.exit(1);
}

console.log(`[test] Running ${files.length} ${scope} test files`);
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: projectRoot,
  stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
