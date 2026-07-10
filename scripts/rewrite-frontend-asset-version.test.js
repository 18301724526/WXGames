const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isLocalAssetUrl,
  withAssetVersion,
  rewriteHtmlAssetVersions,
  rewriteFrontendIndex,
} = require('./rewrite-frontend-asset-version');
const {
  checkManifest,
  resolveLocalAssetPath,
} = require('./check-frontend-script-manifest');

function makeTempFrontend() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgame-frontend-assets-'));
  const root = path.join(repoRoot, 'frontend');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'debug'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'api'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'ui'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'state'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'ecs', 'runtime'), { recursive: true });
  fs.mkdirSync(path.join(root, 'js', 'platform'), { recursive: true });
  [
    'style.css',
    'js/config/GameConfig.js',
    'js/debug/H5LoadTrace.js',
    'js/debug/ActorPickingDiagnostics.js',
    'js/api/ClientCommandSender.js',
    'js/api/GameAPI.js',
    'js/ui/H5DebugDiagnosticsAdapter.js',
    'js/ui/H5ActorPickingDiagnosticsAdapter.js',
    'js/ui/H5GameApiTransportAdapter.js',
    'js/ui/H5AuthStorageAdapter.js',
    'js/ui/H5ShellAdapter.js',
    'js/shared/FormationDeploymentEligibilityAdapter.js',
    'js/state/UIStatePresenterDelegates.js',
    'js/state/UIStatePresenter.js',
    'js/state/UiRuntimeStateStore.js',
    'js/ecs/runtime/EcsModeRuntimeBundle.js',
    'js/platform/CanvasRuntimeContract.js',
    'js/platform/CanvasLayerRegistry.js',
    'js/platform/CanvasActionDescriptorRegistry.js',
    'js/platform/CanvasActionDispatchRegistry.js',
    'js/platform/CanvasActionDispatcher.js',
    'js/platform/CanvasModeOwnershipRuntime.js',
    'js/platform/CanvasModalSnapshotAdapter.js',
    'js/platform/CanvasGameShell.js',
    'app.js',
    'auth.js',
  ].forEach((file) => {
    fs.writeFileSync(path.join(root, file), file.endsWith('.css') ? 'body{}' : 'window.__asset=1;');
  });
  fs.writeFileSync(path.join(repoRoot, 'shared', 'formationDeploymentEligibility.js'), 'window.FormationDeploymentEligibility={};');
  fs.writeFileSync(path.join(repoRoot, 'shared', 'featureFlags.js'), 'window.FeatureFlagCore={};');
  fs.writeFileSync(path.join(repoRoot, 'shared', 'tutorialFlowConfig.js'), 'window.TutorialFlowShared={};');
  return { repoRoot, frontendDir: root };
}

function writeIndex(root, overrides = {}) {
  const version = overrides.version || 'old';
  const html = `<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="style.css?v=${version}">
  <link rel="preload" href="ignored-font.woff2">
</head>
<body>
  <script src="js/config/GameConfig.js?v=${version}"></script>
  <script src="js/debug/H5LoadTrace.js?v=${version}"></script>
  <script src="js/debug/ActorPickingDiagnostics.js?v=${version}"></script>
  <script src="js/api/ClientCommandSender.js?v=${version}"></script>
  <script src="js/api/GameAPI.js?v=${version}"></script>
  <script src="https://cdn.example.test/remote.js?v=${version}"></script>
  <script src="js/ui/H5DebugDiagnosticsAdapter.js?v=${version}"></script>
  <script src="js/ui/H5ActorPickingDiagnosticsAdapter.js?v=${version}"></script>
  <script src="js/ui/H5GameApiTransportAdapter.js?v=${version}"></script>
  <script src="js/ui/H5AuthStorageAdapter.js?v=${version}"></script>
  <script src="js/ui/H5ShellAdapter.js?v=${version}"></script>
  <script src="shared/featureFlags.js?v=${version}"></script>
  <script src="shared/formationDeploymentEligibility.js?v=${version}"></script>
  <script src="shared/tutorialFlowConfig.js?v=${version}"></script>
  <script src="js/shared/FormationDeploymentEligibilityAdapter.js?v=${version}"></script>
  <script src="js/state/UIStatePresenterDelegates.js?v=${version}"></script>
  <script src="js/state/UIStatePresenter.js?v=${version}"></script>
  <script src="js/state/UiRuntimeStateStore.js?v=${version}"></script>
  <script src="js/ecs/runtime/EcsModeRuntimeBundle.js?v=${version}"></script>
  <script src="js/platform/CanvasRuntimeContract.js?v=${version}"></script>
  <script src="js/platform/CanvasLayerRegistry.js?v=${version}"></script>
  <script src="js/platform/CanvasActionDescriptorRegistry.js?v=${version}"></script>
  <script src="js/platform/CanvasActionDispatchRegistry.js?v=${version}"></script>
  <script src="js/platform/CanvasActionDispatcher.js?v=${version}"></script>
  <script src="js/platform/CanvasModeOwnershipRuntime.js?v=${version}"></script>
  <script src="js/platform/CanvasModalSnapshotAdapter.js?v=${version}"></script>
  <script src="js/platform/CanvasGameShell.js?v=${version}"></script>
  <script src="app.js?v=${overrides.appVersion || version}"></script>
  <script src="auth.js?v=${version}"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, 'index.html'), html);
}

test('withAssetVersion replaces only the v query parameter', () => {
  assert.equal(
    withAssetVersion('app.js?foo=1&v=old#boot', 'deploy-abc123'),
    'app.js?foo=1&v=deploy-abc123#boot',
  );
  assert.equal(isLocalAssetUrl('js/app.js'), true);
  assert.equal(isLocalAssetUrl('https://cdn.example.test/app.js'), false);
  assert.equal(isLocalAssetUrl('//cdn.example.test/app.js'), false);
});

test('rewriteHtmlAssetVersions updates local scripts and stylesheets only', () => {
  const { html, updated } = rewriteHtmlAssetVersions(`
<link rel="stylesheet" href="style.css?v=old">
<link rel="preload" href="font.woff2?v=old">
<script src="app.js?v=old"></script>
<script src="https://cdn.example.test/remote.js?v=old"></script>
`, 'deploy-feedface1234');

  assert.equal(updated, 2);
  assert.match(html, /style\.css\?v=deploy-feedface1234/);
  assert.match(html, /app\.js\?v=deploy-feedface1234/);
  assert.match(html, /font\.woff2\?v=old/);
  assert.match(html, /remote\.js\?v=old/);
});

test('rewriteFrontendIndex and manifest guard require one deploy asset version', () => {
  const { repoRoot, frontendDir } = makeTempFrontend();
  writeIndex(frontendDir);

  const result = rewriteFrontendIndex({
    frontendDir,
    version: 'deploy-0123456789ab',
  });
  assert.equal(result.updated, 29);

  const html = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
  assert.match(html, /style\.css\?v=deploy-0123456789ab/);
  assert.match(html, /app\.js\?v=deploy-0123456789ab/);
  assert.match(html, /remote\.js\?v=old/);

  const manifest = checkManifest({
    repoRoot,
    frontendDir,
    requireVersion: 'deploy-0123456789ab',
  });
  assert.equal(manifest.localScriptCount, 28);
  assert.equal(manifest.stylesheetCount, 1);
});

test('manifest guard rejects stale asset versions in published index', () => {
  const { repoRoot, frontendDir } = makeTempFrontend();
  writeIndex(frontendDir, { version: 'deploy-fresh', appVersion: 'stale' });

  assert.throws(() => checkManifest({
    repoRoot,
    frontendDir,
    requireVersion: 'deploy-fresh',
  }), /local assets do not use required cache-busting version/);
});

test('manifest guard resolves deployed shared assets from repo shared directory', () => {
  const { repoRoot, frontendDir } = makeTempFrontend();
  writeIndex(frontendDir);
  fs.writeFileSync(path.join(repoRoot, 'shared', 'battleSimCore.js'), 'window.BattleSimCore={};');
  fs.writeFileSync(path.join(repoRoot, 'shared', 'battleAI.js'), 'window.BattleAI={};');
  fs.appendFileSync(
    path.join(frontendDir, 'index.html'),
    '<script src="shared/battleSimCore.js?v=deploy-0123456789ab"></script>\n<script src="shared/battleAI.js?v=deploy-0123456789ab"></script>\n',
  );

  assert.equal(
    resolveLocalAssetPath('shared/battleSimCore.js', { repoRoot, frontendDir }),
    path.join(repoRoot, 'shared', 'battleSimCore.js'),
  );
  const manifest = checkManifest({
    repoRoot,
    frontendDir,
  });
  assert.equal(manifest.localScriptCount, 30);
});
