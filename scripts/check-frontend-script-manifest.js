const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const INDEX_HTML = path.join(FRONTEND_DIR, 'index.html');
const REQUIRED_SCRIPTS = [
  'js/config/GameConfig.js',
  'js/debug/H5LoadTrace.js',
  'js/api/GameAPI.js',
  'js/ui/H5AuthStorageAdapter.js',
  'js/ui/H5ShellAdapter.js',
  'js/state/UIStatePresenterDelegates.js',
  'js/state/UIStatePresenter.js',
  'js/platform/CanvasLayerRegistry.js',
  'js/platform/CanvasActionDispatchRegistry.js',
  'js/platform/CanvasActionDispatcher.js',
  'js/platform/CanvasGameShell.js',
  'app.js',
  'auth.js',
];

const REQUIRED_ORDER_PAIRS = [
  ['js/state/UIStatePresenterDelegates.js', 'js/state/UIStatePresenter.js'],
  ['js/platform/CanvasActionDispatchRegistry.js', 'js/platform/CanvasActionDispatcher.js'],
  ['js/platform/CanvasLayerRegistry.js', 'js/platform/CanvasGameShell.js'],
  ['js/ui/H5AuthStorageAdapter.js', 'js/ui/H5ShellAdapter.js'],
  ['js/api/GameAPI.js', 'js/ui/H5ShellAdapter.js'],
  ['app.js', 'auth.js'],
];

function extractScripts(html) {
  const scripts = [];
  const regex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
  let match = regex.exec(html);
  while (match) {
    scripts.push(match[1]);
    match = regex.exec(html);
  }
  return scripts;
}

function stripQuery(src) {
  return String(src || '').split('?')[0];
}

function fail(message, detail = []) {
  console.error(`[frontend-script-manifest] ${message}`);
  detail.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');
const scriptSources = extractScripts(html);
const scriptPaths = scriptSources.map(stripQuery);
const localScripts = scriptSources.filter((src) => !/^https?:\/\//i.test(src));
const seen = new Set();
const duplicates = [];
const missingVersion = [];
const missingFiles = [];

for (const src of localScripts) {
  const scriptPath = stripQuery(src);
  if (seen.has(scriptPath)) duplicates.push(scriptPath);
  seen.add(scriptPath);
  if (!/\?v=[^&]+/.test(src)) missingVersion.push(src);
  const resolved = path.resolve(FRONTEND_DIR, scriptPath);
  if (!resolved.startsWith(FRONTEND_DIR + path.sep) && resolved !== FRONTEND_DIR) {
    fail('script path escapes frontend directory', [src]);
  }
  if (!fs.existsSync(resolved)) missingFiles.push(scriptPath);
}

if (duplicates.length > 0) fail('duplicate script paths', duplicates);
if (missingVersion.length > 0) fail('local scripts missing cache-busting ?v=', missingVersion);
if (missingFiles.length > 0) fail('script files missing on disk', missingFiles);

const orderPositions = REQUIRED_SCRIPTS.map((scriptPath) => ({
  scriptPath,
  index: scriptPaths.indexOf(scriptPath),
}));
const missingRequired = orderPositions.filter((entry) => entry.index < 0).map((entry) => entry.scriptPath);
if (missingRequired.length > 0) fail('required scripts missing from index.html', missingRequired);
for (const [before, after] of REQUIRED_ORDER_PAIRS) {
  const beforeIndex = scriptPaths.indexOf(before);
  const afterIndex = scriptPaths.indexOf(after);
  if (beforeIndex < 0 || afterIndex < 0) continue;
  if (beforeIndex > afterIndex) {
    fail('required script order is invalid', [
      `${before} should load before ${after}`,
    ]);
  }
}

console.log(`[frontend-script-manifest] passed: ${localScripts.length} local scripts`);
