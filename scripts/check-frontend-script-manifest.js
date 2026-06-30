const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const REQUIRED_SCRIPTS = [
  'js/config/GameConfig.js',
  'js/debug/H5LoadTrace.js',
  'js/debug/ActorPickingDiagnostics.js',
  'js/api/GameAPI.js',
  'js/ui/H5DebugDiagnosticsAdapter.js',
  'js/ui/H5ActorPickingDiagnosticsAdapter.js',
  'js/ui/H5GameApiTransportAdapter.js',
  'js/ui/H5AuthStorageAdapter.js',
  'js/ui/H5ShellAdapter.js',
  'js/state/UIStatePresenterDelegates.js',
  'js/state/UIStatePresenter.js',
  'js/platform/CanvasRuntimeContract.js',
  'js/platform/CanvasLayerRegistry.js',
  'js/platform/CanvasActionDispatchRegistry.js',
  'js/platform/CanvasActionDispatcher.js',
  'js/ecs/runtime/EcsModeRuntimeBundle.js',
  'js/platform/CanvasModeOwnershipRuntime.js',
  'js/platform/CanvasModalSnapshotAdapter.js',
  'js/platform/CanvasGameShell.js',
  'app.js',
  'auth.js',
];

const REQUIRED_ORDER_PAIRS = [
  // StateWriter is the single state-write entry point; optimistic/index.js eagerly binds it
  // at module-eval (window global), so StateWriter must load first in the browser.
  ['js/state/StateWriter.js', 'js/state/optimistic/index.js'],
  ['js/state/UIStatePresenterDelegates.js', 'js/state/UIStatePresenter.js'],
  ['js/debug/ActorPickingDiagnostics.js', 'js/ecs/input/WorldMapInputActionMap.js'],
  ['js/debug/ActorPickingDiagnostics.js', 'js/platform/CanvasActionController.js'],
  ['js/debug/ActorPickingDiagnostics.js', 'js/ui/H5ActorPickingDiagnosticsAdapter.js'],
  ['js/debug/ClientOperationLog.js', 'js/ui/H5DebugDiagnosticsAdapter.js'],
  ['js/debug/WorldMarchTrace.js', 'js/ui/H5DebugDiagnosticsAdapter.js'],
  ['js/debug/CodexWorldMapDiag.js', 'js/ui/H5DebugDiagnosticsAdapter.js'],
  ['js/ecs/runtime/EcsModeRuntimeBundle.js', 'js/ecs/foundation/WorldTime.js'],
  ['js/ui/H5DebugDiagnosticsAdapter.js', 'js/ui/H5ShellAdapter.js'],
  ['js/ui/H5ActorPickingDiagnosticsAdapter.js', 'js/ui/H5ShellAdapter.js'],
  ['js/api/GameAPI.js', 'js/ui/H5GameApiTransportAdapter.js'],
  ['js/ui/H5GameApiTransportAdapter.js', 'js/ui/H5ShellAdapter.js'],
  ['js/platform/CanvasActionDispatchRegistry.js', 'js/platform/CanvasActionDispatcher.js'],
  ['js/ecs/runtime/EcsModeRuntimeBundle.js', 'js/platform/CanvasModeOwnershipRuntime.js'],
  ['js/platform/CanvasModeOwnershipRuntime.js', 'js/platform/CanvasModalSnapshotAdapter.js'],
  ['js/platform/CanvasModeOwnershipRuntime.js', 'js/platform/CanvasGameApp.js'],
  ['js/platform/CanvasModeOwnershipRuntime.js', 'js/platform/CanvasGameShell.js'],
  ['js/platform/CanvasModalSnapshotAdapter.js', 'js/platform/CanvasGameApp.js'],
  ['js/platform/CanvasModalSnapshotAdapter.js', 'js/platform/CanvasGameShell.js'],
  ['js/platform/CanvasRuntimeContract.js', 'js/platform/H5CanvasRuntime.js'],
  ['js/platform/CanvasLayerRegistry.js', 'js/platform/CanvasGameShell.js'],
  ['js/ui/H5AuthStorageAdapter.js', 'js/ui/H5ShellAdapter.js'],
  ['js/api/GameAPI.js', 'js/ui/H5ShellAdapter.js'],
  ['app.js', 'auth.js'],
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    repoRoot: DEFAULT_REPO_ROOT,
    frontendDir: DEFAULT_FRONTEND_DIR,
    requireVersion: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--frontend-dir') {
      options.frontendDir = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--repo-root') {
      options.repoRoot = path.resolve(argv[index + 1] || '');
      index += 1;
    } else if (arg === '--require-version') {
      options.requireVersion = argv[index + 1] || '';
      index += 1;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  return options;
}

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

function getQueryVersion(src) {
  const query = String(src || '').split('#')[0].split('?')[1] || '';
  return new URLSearchParams(query).get('v') || '';
}

function resolveLocalAssetPath(srcPath, options = {}) {
  const frontendDir = path.resolve(options.frontendDir || DEFAULT_FRONTEND_DIR);
  const repoRoot = path.resolve(options.repoRoot || path.resolve(frontendDir, '..'));
  const normalized = stripQuery(srcPath).replace(/\\/g, '/');
  const baseDir = normalized.startsWith('shared/') ? repoRoot : frontendDir;
  const resolved = path.resolve(baseDir, normalized);
  const allowedRoot = normalized.startsWith('shared/') ? path.join(repoRoot, 'shared') : frontendDir;
  if (!resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
    fail('script path escapes frontend directory', [srcPath]);
  }
  return resolved;
}

function extractStylesheets(html) {
  const links = [];
  const regex = /<link\b[^>]*>/gi;
  let match = regex.exec(html);
  while (match) {
    const tag = match[0];
    const rel = /\brel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] || '';
    if (!rel.split(/\s+/).some((item) => item.toLowerCase() === 'stylesheet')) {
      match = regex.exec(html);
      continue;
    }
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] || '';
    if (href) links.push(href);
    match = regex.exec(html);
  }
  return links;
}

function fail(message, detail = []) {
  const lines = [message, ...detail.map((item) => `- ${item}`)];
  throw new Error(lines.join('\n'));
}

function checkManifest(options = {}) {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const frontendDir = options.frontendDir || DEFAULT_FRONTEND_DIR;
  const indexHtml = path.join(frontendDir, 'index.html');
  const html = fs.readFileSync(indexHtml, 'utf8');
  const scriptSources = extractScripts(html);
  const scriptPaths = scriptSources.map(stripQuery);
  const localScripts = scriptSources.filter((src) => !/^https?:\/\//i.test(src));
  const stylesheetSources = extractStylesheets(html).filter((src) => !/^https?:\/\//i.test(src));
  const localAssets = [...stylesheetSources, ...localScripts];
  const seen = new Set();
  const duplicates = [];
  const missingVersion = [];
  const mismatchedVersion = [];
  const missingFiles = [];

  for (const src of localAssets) {
    const scriptPath = stripQuery(src);
    if (seen.has(scriptPath)) duplicates.push(scriptPath);
    seen.add(scriptPath);
    if (!/\?v=[^&]+/.test(src)) missingVersion.push(src);
    if (options.requireVersion && getQueryVersion(src) !== options.requireVersion) {
      mismatchedVersion.push(`${src} (expected v=${options.requireVersion})`);
    }
    const resolved = resolveLocalAssetPath(scriptPath, { frontendDir, repoRoot });
    if (!fs.existsSync(resolved)) missingFiles.push(scriptPath);
  }

  if (duplicates.length > 0) fail('duplicate local asset paths', duplicates);
  if (missingVersion.length > 0) fail('local assets missing cache-busting ?v=', missingVersion);
  if (mismatchedVersion.length > 0) fail('local assets do not use required cache-busting version', mismatchedVersion);
  if (missingFiles.length > 0) fail('local asset files missing on disk', missingFiles);

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

  return {
    localScriptCount: localScripts.length,
    stylesheetCount: stylesheetSources.length,
  };
}

function main() {
  const options = parseArgs();
  const result = checkManifest(options);
  console.log(`[frontend-script-manifest] passed: ${result.localScriptCount} local scripts, ${result.stylesheetCount} stylesheets`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[frontend-script-manifest] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  extractScripts,
  extractStylesheets,
  stripQuery,
  getQueryVersion,
  resolveLocalAssetPath,
  checkManifest,
};
