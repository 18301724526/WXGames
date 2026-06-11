#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const docsRoot = path.join(repoRoot, 'docs');

const officialDocPaths = [
  'docs/current_gameplay_design_2026-06-09.md',
  'docs/current_technical_architecture_2026-06-09.md',
  'docs/current_product_design_2026-06-09.md',
  'docs/long_term_architecture_refactor_plan_2026-06-08.md',
  'docs/architecture_module_responsibility_index_2026-06-08.md',
  'docs/production_engineering_roadmap_2026-06-09.md',
  'docs/6月11日重构与问题交接.md',
  'docs/stable_block_promotion_matrix_2026-06-09.md',
  'docs/stable_block_manifest_2026-06-09.json',
];

const obsoleteDocPatterns = [
  /_v\d/i,
  /v\d+\.\d+/i,
  /handoff/i,
  /release_notes/i,
  /test_cases/i,
  /implementation_steps/i,
  /architecture_refactor_plan_2026-06-04/i,
  /world_map_runtime_architecture/i,
  /完整新手强引导/,
  /统一Canvas/,
  /设计_v/,
  /任务_v/,
  /策划案_v/,
  /路线图_v/,
  /调优补充_v/,
  /交接文档/,
  /素材清理记录/,
];

const requiredText = {
  'docs/current_gameplay_design_2026-06-09.md': [
    '后端权威 / Server Authority',
    '菱形等距 tile 世界地图',
    '敌对势力直接拦截或攻击',
    'Excel/table source -> validation tool -> JSON/registry',
  ],
  'docs/current_technical_architecture_2026-06-09.md': [
    'Canvas-only',
    'diamond isometric square-tile',
    'full wrapping torus',
    'CommandAuthorityContract',
    'AoiSyncSnapshot',
    'Mature Engine Canvas Layer Contract',
    'Hit priority queue',
    'mainHud',
    'Production Engineering',
  ],
  'docs/current_product_design_2026-06-09.md': [
    '实时操作的 Civilization-like 策略经营游戏',
    '30 FPS',
    '账号长期存在，世界可以重开',
  ],
  'docs/long_term_architecture_refactor_plan_2026-06-08.md': [
    'P11 - Stable Block Hardening',
    'P12 - 生产工程化 / Production Engineering',
    'Mature Engine Canvas Layer Contract',
    'CanvasLayerRegistry` owns the layer metadata, physical order, render order, hit order',
    'stable_block_promotion_matrix_2026-06-09.md',
  ],
  'docs/architecture_module_responsibility_index_2026-06-08.md': [
    'Stable Promotion Convention',
    'CanvasLayerRegistry.getPhysicalLayerStack()',
    'CanvasLayerRegistry.compareHitPriority(left, right)',
    'H5CanvasRuntime.test.js',
    'docs/production_engineering_roadmap_2026-06-09.md',
    'docs/stable_block_promotion_matrix_2026-06-09.md',
  ],
  'docs/production_engineering_roadmap_2026-06-09.md': [
    'Anti-Mud Rules',
    'P12 - 生产工程化 / Production Engineering',
    'Large-Studio Parity Definition',
  ],
  'docs/6月11日重构与问题交接.md': [
    'P12-007',
    'GameplayConfigRuntime',
    'server hook anomaly',
    'CONFIG_RELEASE_GATE=required',
    '08639bab086d5d87ebb7445a043ffb72cc88754c',
    '613/613',
  ],
  'docs/stable_block_promotion_matrix_2026-06-09.md': [
    'diamond isometric square-tile map',
    'full wrapping torus',
    'CanvasLayerContract',
    'single input surface',
    'ServerTimelineSnapshot',
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function collectDocs() {
  return fs.readdirSync(docsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `docs/${entry.name}`);
}

function assertOfficialDocsExist() {
  for (const relativePath of officialDocPaths) {
    assert(fs.existsSync(path.join(repoRoot, relativePath)), `Missing official doc: ${relativePath}`);
  }
}

function assertRequiredText() {
  for (const [relativePath, snippets] of Object.entries(requiredText)) {
    const text = readText(relativePath);
    for (const snippet of snippets) {
      assert(text.includes(snippet), `Missing required text in ${relativePath}: ${snippet}`);
    }
  }
}

function assertNoReplacementChars() {
  for (const relativePath of officialDocPaths.filter((item) => item.endsWith('.md'))) {
    const text = readText(relativePath);
    assert(!text.includes('\uFFFD'), `Replacement character found in ${relativePath}`);
  }
}

function assertNoObsoleteDocs() {
  const official = new Set(officialDocPaths);
  const obsolete = collectDocs().filter((relativePath) => (
    !official.has(relativePath)
    && obsoleteDocPatterns.some((pattern) => pattern.test(path.basename(relativePath)))
  ));
  assert(obsolete.length === 0, `Obsolete/non-authoritative docs remain:\n${obsolete.join('\n')}`);
}

function collectFiles(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor' || entry.name === 'node_modules') continue;
      collectFiles(fullPath, result);
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      result.push(fullPath);
    }
  }
  return result;
}

function assertCanvasBusinessLayerHasNoDomUi() {
  const scannedRoots = [
    path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers'),
    path.join(repoRoot, 'frontend', 'js', 'state'),
  ];
  const scannedFiles = [
    ...scannedRoots.flatMap((root) => collectFiles(root)),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameApp.js'),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasGameRenderer.js'),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasActionController.js'),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'CanvasActionDispatcher.js'),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'GameCommandService.js'),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'WorldMapRuntime.js'),
    path.join(repoRoot, 'frontend', 'js', 'platform', 'WorldMapRuntimeCoordinator.js'),
  ];
  const allowlistedFiles = new Set([
    path.normalize(path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers', 'CanvasAssetRenderer.js')),
  ]);
  const forbiddenPattern = /\b(document|querySelector|getElementById|createElement|appendChild|removeChild|prepend|insertAdjacentHTML|innerHTML|outerHTML|classList|HTMLElement)\b|\bstyle\.display\b/;
  const offenders = scannedFiles
    .filter((file) => fs.existsSync(file) && !allowlistedFiles.has(path.normalize(file)))
    .flatMap((file) => {
      const relative = path.relative(repoRoot, file);
      return fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => ({ relative, line, lineNumber: index + 1 }))
        .filter(({ line }) => forbiddenPattern.test(line))
        .map(({ relative: fileName, lineNumber, line }) => `${fileName}:${lineNumber}: ${line.trim()}`);
    });
  assert(
    offenders.length === 0,
    [
      'Canvas business layer must not use DOM UI APIs. Use Canvas rendering and Canvas hitTargets only.',
      ...offenders,
    ].join('\n'),
  );
}

assertOfficialDocsExist();
assertRequiredText();
assertNoReplacementChars();
assertNoObsoleteDocs();
assertCanvasBusinessLayerHasNoDomUi();

console.log('[official-docs] passed');
