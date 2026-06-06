#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const tutorialPlanPath = path.join(repoRoot, 'docs', '完整新手强引导与任务系统实施计划_2026-06-05.md');
const architecturePlanPath = path.join(repoRoot, 'docs', 'architecture_refactor_plan_2026-06-04.md');
const worldMapRuntimeArchitecturePath = path.join(repoRoot, 'docs', 'world_map_runtime_architecture.md');
const unifiedCanvasPlanPath = path.join(repoRoot, 'docs', '统一Canvas多平台核心推进计划_v0.1.md');

const tutorialPlan = fs.readFileSync(tutorialPlanPath, 'utf8');
const architecturePlan = fs.readFileSync(architecturePlanPath, 'utf8');
const worldMapRuntimeArchitecture = fs.readFileSync(worldMapRuntimeArchitecturePath, 'utf8');
const unifiedCanvasPlan = fs.readFileSync(unifiedCanvasPlanPath, 'utf8');

function assertIncludes(doc, text, label) {
  if (!doc.includes(text)) {
    throw new Error(`Missing required plan text: ${label}`);
  }
}

function assertMatch(doc, pattern, label) {
  if (!pattern.test(doc)) {
    throw new Error(`Missing required plan pattern: ${label}`);
  }
}

function collectFiles(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
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
  if (offenders.length) {
    throw new Error(
      [
        'Canvas business layer must not use DOM UI APIs. Use Canvas rendering and Canvas hitTargets only.',
        ...offenders,
      ].join('\n'),
    );
  }
}

assertIncludes(
  tutorialPlan,
  '必须执行真实浏览器测试、单元测试、代码检查，并推送 GitHub `origin` 与服务器私服 Git `private`',
  'current double-remote quality gate',
);
assertIncludes(tutorialPlan, '## 原始需求记录', 'original request archive');
assertIncludes(tutorialPlan, '## P0 任务', 'P0 section');
assertIncludes(tutorialPlan, '## P1 任务', 'P1 section');
assertIncludes(tutorialPlan, '## P2 任务', 'P2 section');
assertIncludes(tutorialPlan, '### P1.7 科技系统收尾讲解并交还控制权（已完成）', 'final tech tutorial completed');
assertIncludes(tutorialPlan, '### P2.1 全系统覆盖引导补齐（已完成）', 'all-system tutorial coverage completed');
assertIncludes(tutorialPlan, '### P2.2 策划友好的任务导表软件（已完成）', 'planner-friendly task uploader completed');
assertMatch(tutorialPlan, /P2\.3\.\d+ 完成/, 'P2.3 refactor progress entries');

assertIncludes(
  architecturePlan,
  '推送到 GitHub `origin/main` 与服务器私服 Git `private/main`',
  'architecture plan current double-remote rule',
);
assertIncludes(
  architecturePlan,
  '当前执行规则以 GitHub `origin` + 服务器私服 `private` 的双远端要求为准',
  'legacy remote naming note',
);
assertIncludes(
  worldMapRuntimeArchitecture,
  'Canvas-only UI 是死规矩',
  'world map canvas-only UI rule',
);
assertIncludes(
  worldMapRuntimeArchitecture,
  '浏览器 H5 宿主层只能创建 canvas、挂载 canvas、绑定输入事件；不能用 DOM overlay、DOM 节点或 HTML 字符串替代任何游戏 UI',
  'world map host-only DOM boundary',
);
assertIncludes(
  unifiedCanvasPlan,
  '这是死规矩',
  'unified canvas plan DOM UI ban',
);
assertIncludes(
  unifiedCanvasPlan,
  '任务、引导、建筑、人口、事件、军事、科技、文明、名人、弹窗、HUD、调试按钮等游戏内可见业务界面都不得使用 DOM',
  'unified canvas plan visible UI DOM ban',
);
assertCanvasBusinessLayerHasNoDomUi();

console.log('Refactor and tutorial plan document guards passed.');
