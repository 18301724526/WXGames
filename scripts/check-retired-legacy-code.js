const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

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
  'frontend/js/platform/renderers/HomeCanvasRenderer.js',
  'frontend/js/platform/renderers/TalentPolicyCanvasRenderer.js',
  'frontend/js/state/presenters/WorldRadarPresenter.js',
]);

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

function runGitLsFiles() {
  const result = spawnSync('git', ['ls-files'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'git ls-files failed');
  }
  return result.stdout.split(/\r?\n/).filter(Boolean).map((file) => file.replace(/\\/g, '/'));
}

function isActiveProductionSource(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  if (!ACTIVE_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (!/\.(js|mjs|cjs|html)$/.test(normalized)) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function findRetiredFileOffenders(files = [], options = {}) {
  const exists = typeof options.exists === 'function' ? options.exists : fs.existsSync;
  const tracked = new Set(files.map((file) => String(file || '').replace(/\\/g, '/')));
  return RETIRED_FILES.filter((file) => tracked.has(file) && exists(file));
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

function findOffenders(files = runGitLsFiles()) {
  return {
    files: findRetiredFileOffenders(files),
    symbols: findRetiredSymbolOffenders(files),
  };
}

function hasOffenders(offenders = {}) {
  return Boolean(offenders.files?.length || offenders.symbols?.length);
}

function main() {
  const offenders = findOffenders();
  if (hasOffenders(offenders)) {
    console.error('[retired-legacy-code] retired active code found:');
    offenders.files.forEach((file) => console.error(`- retired file still tracked: ${file}`));
    offenders.symbols.forEach(({ file, symbol }) => console.error(`- ${file}: ${symbol}`));
    process.exit(1);
  }
  console.log('[retired-legacy-code] passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  ACTIVE_SOURCE_PREFIXES,
  EXCLUDED_PATH_PATTERNS,
  RETIRED_FILES,
  RETIRED_SYMBOLS,
  findOffenders,
  findRetiredFileOffenders,
  findRetiredSymbolsInText,
  findRetiredSymbolOffenders,
  hasRetiredSymbol,
  hasOffenders,
  isActiveProductionSource,
};
