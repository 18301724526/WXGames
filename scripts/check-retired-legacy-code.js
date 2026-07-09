const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ACTIVE_SOURCE_PREFIXES = Object.freeze([
  'backend/',
  'frontend/js/',
  'frontend/minigame/',
]);

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)tests?\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

const RETIRED_SYMBOLS = Object.freeze([
  'HomeCanvasRenderer',
  'CanvasBlockingPanelSnapshotCalls',
  'openTalentPolicy',
  'startExplore',
  'claimExplore',
  'renderWorldScoutUnitsLegacy',
  'renderWorldCityCommandLegacyOverlay',
  'getWorldScoutUnitRoutePoints',
  'getWorldScoutUnitProgress',
  'getWorldScoutUnitPoint',
  'getWorldScoutUnitFramePath',
  'WorldRadarPresenter',
  'buildWorldRadarViewState',
  'worldRadarDrag',
]);

const RETIRED_FILES = Object.freeze([
  'frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js',
  'frontend/js/platform/renderers/HomeCanvasRenderer.js',
  'frontend/js/platform/renderers/TalentPolicyCanvasRenderer.js',
  'frontend/js/state/presenters/WorldRadarPresenter.js',
]);

const RETIRED_LAYER_NAME = ['do', 'main'].join('');
const RETIRED_LAYER_PATHS = Object.freeze([
  `backend/${RETIRED_LAYER_NAME}/`,
  `frontend/js/${RETIRED_LAYER_NAME}/`,
  `frontend/js/ecs/${RETIRED_LAYER_NAME}/`,
]);

const RETIRED_LAYER_IMPORT_PATTERNS = Object.freeze([
  new RegExp(`require\\(\\s*['"][^'"]*/${RETIRED_LAYER_NAME}/`),
  new RegExp(`from\\s+['"][^'"]*/${RETIRED_LAYER_NAME}/`),
  new RegExp(`import\\(\\s*['"][^'"]*/${RETIRED_LAYER_NAME}/`),
]);

const EXCLUDED_SCAN_DIRS = new Set(['.git', '.codegraph', 'node_modules', 'vendor']);

const RETIRED_LAYER_TOKEN_PATTERN = new RegExp(
  [
    `\\.${escapeRegExp(RETIRED_LAYER_NAME)}\\b`,
    `\\b${escapeRegExp(RETIRED_LAYER_NAME)}\\s*:`,
    `\\b[A-Z0-9_]*${escapeRegExp(RETIRED_LAYER_NAME.toUpperCase())}[A-Z0-9_]*\\b`,
    `['"\`]${escapeRegExp(RETIRED_LAYER_NAME)}['"\`]`,
  ].join('|'),
);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasRetiredSymbol(text = '', symbol = '') {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(symbol)}([^A-Za-z0-9_$]|$)`);
  return pattern.test(String(text || ''));
}

function findRetiredSymbolsInText(text = '') {
  return RETIRED_SYMBOLS.filter((symbol) => hasRetiredSymbol(text, symbol));
}

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/');
}

function hasGitWorkTree(cwd = process.cwd()) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function runGitLsFiles(cwd = process.cwd()) {
  const result = spawnSync('git', ['ls-files'], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'git ls-files failed');
  }
  return result.stdout.split(/\r?\n/).filter(Boolean).map(normalizePath);
}

function collectFilesystemFiles(root = process.cwd()) {
  const files = [];

  function visit(directory, relativePrefix = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_SCAN_DIRS.has(entry.name)) continue;
      const relativePath = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      if (entry.isFile()) files.push(normalizePath(relativePath));
    }
  }

  visit(root);
  return files.sort();
}

function collectInspectableFiles(cwd = process.cwd(), options = {}) {
  const isGitWorkTree = typeof options.hasGitWorkTree === 'function'
    ? options.hasGitWorkTree(cwd)
    : hasGitWorkTree(cwd);
  if (isGitWorkTree) {
    return { mode: 'git', files: runGitLsFiles(cwd) };
  }
  return { mode: 'filesystem', files: collectFilesystemFiles(cwd) };
}

function isActiveProductionSource(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  if (!ACTIVE_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (!/\.(js|mjs|cjs|html)$/.test(normalized)) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findRetiredFileOffenders(files = [], options = {}) {
  const exists = typeof options.exists === 'function' ? options.exists : fs.existsSync;
  const tracked = new Set(files.map(normalizePath));
  return RETIRED_FILES.filter((file) => tracked.has(file) && exists(file));
}

function findRetiredLayerPathOffenders(files = [], options = {}) {
  const exists = typeof options.exists === 'function' ? options.exists : fs.existsSync;
  return files
    .map(normalizePath)
    .filter((file) => RETIRED_LAYER_PATHS.some((prefix) => file.startsWith(prefix)))
    .filter((file) => exists(file));
}

function findRetiredLayerImportOffendersInText(file, text = '') {
  const offenders = [];
  String(text || '').split(/\r?\n/).forEach((line, index) => {
    if (!RETIRED_LAYER_IMPORT_PATTERNS.some((pattern) => pattern.test(line))) return;
    offenders.push({
      file: String(file || '').replace(/\\/g, '/'),
      line: index + 1,
      evidence: line.trim().replace(/\s+/g, ' '),
    });
  });
  return offenders;
}

function findRetiredLayerImportOffenders(files = []) {
  const offenders = [];
  const sourceFiles = files.filter(isActiveProductionSource);
  for (const file of sourceFiles) {
    if (!fs.existsSync(file)) continue;
    offenders.push(...findRetiredLayerImportOffendersInText(file, fs.readFileSync(file, 'utf8')));
  }
  return offenders;
}

function findRetiredLayerTokenOffendersInText(file, text = '') {
  const offenders = [];
  String(text || '').split(/\r?\n/).forEach((line, index) => {
    if (!RETIRED_LAYER_TOKEN_PATTERN.test(line)) return;
    offenders.push({
      file: String(file || '').replace(/\\/g, '/'),
      line: index + 1,
      evidence: line.trim().replace(/\s+/g, ' '),
    });
  });
  return offenders;
}

function findRetiredLayerTokenOffenders(files = []) {
  const offenders = [];
  const sourceFiles = files.filter(isActiveProductionSource);
  for (const file of sourceFiles) {
    if (!fs.existsSync(file)) continue;
    offenders.push(...findRetiredLayerTokenOffendersInText(file, fs.readFileSync(file, 'utf8')));
  }
  return offenders;
}

function findRetiredSymbolOffenders(files = []) {
  const offenders = [];
  const sourceFiles = files.filter(isActiveProductionSource);
  for (const file of sourceFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    findRetiredSymbolsInText(text).forEach((symbol) => offenders.push({ file, symbol }));
  }
  return offenders;
}

function findOffenders(files = null) {
  const inspectedFiles = Array.isArray(files) ? files : collectInspectableFiles().files;
  return {
    files: findRetiredFileOffenders(inspectedFiles),
    retiredLayerPaths: findRetiredLayerPathOffenders(inspectedFiles),
    retiredLayerImports: findRetiredLayerImportOffenders(inspectedFiles),
    retiredLayerTokens: findRetiredLayerTokenOffenders(inspectedFiles),
    symbols: findRetiredSymbolOffenders(inspectedFiles),
  };
}

function hasOffenders(offenders = {}) {
  return Boolean(
    offenders.files?.length
      || offenders.retiredLayerPaths?.length
      || offenders.retiredLayerImports?.length
      || offenders.retiredLayerTokens?.length
      || offenders.symbols?.length,
  );
}

function main() {
  let inventory;
  try {
    inventory = collectInspectableFiles();
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
  const offenders = findOffenders(inventory.files);
  if (hasOffenders(offenders)) {
    console.error('[retired-legacy-code] retired active code found:');
    offenders.files.forEach((file) => console.error(`- retired file still tracked: ${file}`));
    offenders.retiredLayerPaths.forEach((file) =>
      console.error(`- retired layer file still tracked: ${file}`),
    );
    offenders.retiredLayerImports.forEach(({ file, line, evidence }) =>
      console.error(`- retired layer import ${file}:${line}: ${evidence}`),
    );
    offenders.retiredLayerTokens.forEach(({ file, line, evidence }) =>
      console.error(`- retired layer token ${file}:${line}: ${evidence}`),
    );
    offenders.symbols.forEach(({ file, symbol }) => console.error(`- ${file}: ${symbol}`));
    process.exit(1);
  }
  console.log(`[retired-legacy-code] passed (${inventory.mode})`);
}

if (require.main === module) {
  main();
}

module.exports = {
  ACTIVE_SOURCE_PREFIXES,
  EXCLUDED_SCAN_DIRS,
  EXCLUDED_PATH_PATTERNS,
  RETIRED_FILES,
  RETIRED_LAYER_NAME,
  RETIRED_LAYER_IMPORT_PATTERNS,
  RETIRED_LAYER_PATHS,
  RETIRED_LAYER_TOKEN_PATTERN,
  RETIRED_SYMBOLS,
  collectFilesystemFiles,
  collectInspectableFiles,
  findOffenders,
  findRetiredFileOffenders,
  findRetiredLayerImportOffenders,
  findRetiredLayerImportOffendersInText,
  findRetiredLayerPathOffenders,
  findRetiredLayerTokenOffenders,
  findRetiredLayerTokenOffendersInText,
  findRetiredSymbolsInText,
  findRetiredSymbolOffenders,
  hasRetiredSymbol,
  hasOffenders,
  hasGitWorkTree,
  isActiveProductionSource,
  normalizePath,
  runGitLsFiles,
};
