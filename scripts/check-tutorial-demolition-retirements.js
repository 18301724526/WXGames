'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

const RETIRED_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'A4-host-context-boundary',
    reason: 'The host-aware tutorial context was coupled to game internals.',
    paths: Object.freeze([
      'scripts/check-tutorial-host-context-boundary.js',
      'scripts/check-tutorial-host-context-boundary.test.js',
      'frontend/js/tutorial/TutorialHostContextStepScript.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-engine-purity',
    reason: 'The old in-game engine was removed; the replacement library gets a new purity gate.',
    paths: Object.freeze([
      'scripts/check-tutorial-engine-purity.js',
      'scripts/check-tutorial-engine-purity.test.js',
      'frontend/js/tutorial-engine/StepScriptTypeRegistry.js',
      'frontend/js/tutorial-engine/StepScriptRunner.js',
      'frontend/js/tutorial-engine/StepScriptRunner.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-step-config-counts',
    reason: 'The 22-rule EXPECTED_RULE_IDS contract belongs to the removed flow.',
    paths: Object.freeze([
      'scripts/check-tutorial-step-config-purity.js',
      'scripts/check-tutorial-step-config-purity.test.js',
      'frontend/js/tutorial-config/TaskPanelStepScripts.js',
      'frontend/js/tutorial-config/TaskPanelStepScripts.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-rule-inventory',
    reason: 'The old FlowRegistry rule inventory is no longer authoritative.',
    paths: Object.freeze([
      'scripts/generate-tutorial-rule-inventory.js',
      'scripts/generate-tutorial-rule-inventory.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-action-matcher-purity',
    reason: 'The game-owned matcher was removed; the replacement action table is library-owned.',
    paths: Object.freeze([
      'scripts/check-tutorial-action-matches-purity.js',
      'scripts/check-tutorial-action-matches-purity.test.js',
      'frontend/js/platform/TutorialActionMatches.js',
      'frontend/js/platform/TutorialActionMatches.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-server-advance-single-source',
    reason: 'The server tutorial state machine and manualAdvance path were deleted.',
    paths: Object.freeze([
      'scripts/check-tutorial-advance-single-source.js',
      'scripts/check-tutorial-advance-single-source.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-server-step-contract',
    reason: 'The server/client step table was deleted with server tutorial authority.',
    paths: Object.freeze([
      'scripts/check-tutorial-step-contract.js',
      'scripts/check-tutorial-step-contract.test.js',
      'shared/tutorialFlowConfig.js',
      'shared/tutorialFlowConfig.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-host-surface-inventory',
    reason: 'The old host surface inventory described deleted host-aware seams.',
    paths: Object.freeze([
      'scripts/generate-tutorial-host-surface-inventory.js',
      'scripts/generate-tutorial-host-surface-inventory.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-event-contract-inventory',
    reason: 'The old EventRegistry advancement handlers were deleted.',
    paths: Object.freeze([
      'scripts/generate-tutorial-event-contracts.js',
      'scripts/generate-tutorial-event-contracts.test.js',
      'frontend/js/tutorial/TutorialGuideEventRegistry.contract.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-hit-target-inventory',
    reason: 'The old missingTypes inventory targeted the deleted controller and config.',
    paths: Object.freeze([
      'scripts/generate-tutorial-hit-target-types.js',
      'scripts/generate-tutorial-hit-target-types.test.js',
    ]),
  }),
  Object.freeze({
    id: 'A4-old-guide-director-contracts',
    reason: 'The game-owned guide director, policy, resolver, and architecture tests were removed.',
    paths: Object.freeze([
      'frontend/js/tutorial/TutorialGuideStepPolicy.js',
      'frontend/js/tutorial/TutorialGuideStepPolicy.test.js',
      'frontend/js/tutorial/TutorialGuideTargetResolver.js',
      'frontend/js/tutorial/TutorialGuideTargetResolver.test.js',
      'frontend/js/tutorial/TutorialGuideArchitecture.test.js',
      'frontend/js/tutorial/TutorialHostContext.js',
      'frontend/js/tutorial/TutorialGuideController.js',
      'frontend/js/tutorial/TutorialGuideController.test.js',
    ]),
  }),
]);

function inspectRetirements(repoRoot = DEFAULT_REPO_ROOT) {
  const violations = [];
  RETIRED_CONTRACTS.forEach((contract) => {
    contract.paths.forEach((relativePath) => {
      if (fs.existsSync(path.join(repoRoot, relativePath))) {
        violations.push(`${contract.id} reintroduced retired path: ${relativePath}`);
      }
    });
  });
  return {
    report: 'tutorial-demolition-retirements',
    mode: 'blocking',
    contracts: RETIRED_CONTRACTS,
    violations,
  };
}

function renderText(report) {
  const lines = ['[tutorial-demolition-retirements] blocking gate'];
  report.contracts.forEach((contract) => {
    lines.push(`declared retired: ${contract.id} - ${contract.reason}`);
  });
  lines.push(`violations: ${report.violations.length}`);
  if (report.violations.length) report.violations.forEach((violation) => lines.push(`- ${violation}`));
  else lines.push('passed');
  return `${lines.join('\n')}\n`;
}

function main() {
  const report = inspectRetirements();
  process.stdout.write(renderText(report));
  if (report.violations.length) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  DEFAULT_REPO_ROOT,
  RETIRED_CONTRACTS,
  inspectRetirements,
  renderText,
};
