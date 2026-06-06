#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const tutorialPlanPath = path.join(repoRoot, 'docs', '完整新手强引导与任务系统实施计划_2026-06-05.md');
const architecturePlanPath = path.join(repoRoot, 'docs', 'architecture_refactor_plan_2026-06-04.md');

const tutorialPlan = fs.readFileSync(tutorialPlanPath, 'utf8');
const architecturePlan = fs.readFileSync(architecturePlanPath, 'utf8');

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

console.log('Refactor and tutorial plan document guards passed.');
