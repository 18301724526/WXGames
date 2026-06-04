#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const docPath = path.join(repoRoot, 'docs', 'architecture_refactor_plan_2026-06-04.md');
const doc = fs.readFileSync(docPath, 'utf8');

function assertIncludes(text, label) {
  if (!doc.includes(text)) {
    throw new Error(`Missing required refactor-plan text: ${label}`);
  }
}

function assertMatch(pattern, label) {
  if (!pattern.test(doc)) {
    throw new Error(`Missing required refactor-plan pattern: ${label}`);
  }
}

assertIncludes('每一步必须先写或更新回归测试，再提交代码。', 'test-before-commit rule');
assertIncludes('每一步提交后必须推送到服务器远端 `origin`。', 'push-to-origin rule');
assertIncludes('每一步必须更新本文档的提交留档', 'commit archive rule');
assertIncludes('## 提交留档', 'archive section');
assertIncludes('### Step 0 留档', 'current step archive');

for (let step = 0; step <= 7; step += 1) {
  assertIncludes(`### Step ${step}`, `step ${step} section`);
}

const routeSection = doc.split('\n## 测试策略')[0].split('\n## 重构路线')[1] || '';
const stepSections = routeSection.split(/\n### Step \d+/).slice(1);
if (stepSections.length < 8) {
  throw new Error(`Expected at least 8 step sections, found ${stepSections.length}`);
}

stepSections.forEach((section, index) => {
  assertMatchInSection(section, /回归测试：/, index, 'regression test heading');
  assertMatchInSection(section, /提交要求：/, index, 'commit requirement heading');
  assertMatchInSection(section, /推送到服务器远端 `origin\/main`/, index, 'push target');
  assertMatchInSection(section, /留档要求：/, index, 'archive requirement heading');
});

function assertMatchInSection(section, pattern, step, label) {
  if (!pattern.test(section)) {
    throw new Error(`Step ${step} missing ${label}`);
  }
}

console.log('Refactor plan document guard passed.');
