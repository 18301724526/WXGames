'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const REQUIRED_ACTIONS = Object.freeze([
  {
    actionType: 'buildBuilding',
    descriptorId: 'building.build',
    commandType: 'build',
  },
  {
    actionType: 'upgradeBuilding',
    descriptorId: 'building.upgrade',
    commandType: 'upgrade',
  },
]);
const REQUIRED_DESCRIPTOR_FIELDS = Object.freeze([
  'id',
  'actionType',
  'owner',
  'surface',
  'kind',
  'commandType',
  'payloadBuilder',
  'traceFields',
  'visualStateSource',
]);

function readSource(repoRoot, relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function defaultRegistry(repoRoot = DEFAULT_REPO_ROOT) {
  return require(path.join(repoRoot, 'frontend/js/platform/CanvasActionDescriptorRegistry.js'));
}

function inspectStep5ActionDescriptorCoverage(options = {}) {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const registry = options.registry || defaultRegistry(repoRoot);
  const sources = {
    controller: options.sources?.controller
      ?? readSource(repoRoot, 'frontend/js/platform/CanvasActionController.js'),
    dispatchRegistry: options.sources?.dispatchRegistry
      ?? readSource(repoRoot, 'frontend/js/platform/CanvasActionDispatchRegistry.js'),
  };
  const violations = [];

  REQUIRED_ACTIONS.forEach((expected) => {
    const descriptor = registry.resolve?.({ type: expected.actionType }) || null;
    if (!descriptor) {
      violations.push(`${expected.actionType} missing action descriptor`);
      return;
    }
    REQUIRED_DESCRIPTOR_FIELDS.forEach((field) => {
      const value = descriptor[field];
      if (value === undefined || value === null || value === '') {
        violations.push(`${expected.actionType} descriptor missing ${field}`);
      }
    });
    if (descriptor.id !== expected.descriptorId) {
      violations.push(`${expected.actionType} descriptor id drifted: ${descriptor.id}`);
    }
    if (descriptor.kind !== 'command-submit') {
      violations.push(`${expected.actionType} descriptor must be command-submit`);
    }
    if (descriptor.commandType !== expected.commandType) {
      violations.push(`${expected.actionType} commandType must be ${expected.commandType}`);
    }
    if (!Array.isArray(descriptor.traceFields) || !descriptor.traceFields.includes('buildingId')) {
      violations.push(`${expected.actionType} traceFields must include buildingId`);
    }
    const payload = registry.buildPayload?.({ type: expected.actionType, buildingId: 'house' });
    if (JSON.stringify(payload) !== JSON.stringify({ buildingId: 'house' })) {
      violations.push(`${expected.actionType} payloadBuilder must emit { buildingId }`);
    }
  });

  [
    "case 'buildBuilding'",
    "case 'upgradeBuilding'",
    'handle_buildBuilding',
    'handle_upgradeBuilding',
    'handleBuilding(action',
  ].forEach((token) => {
    if (sources.controller.includes(token)) {
      violations.push(`CanvasActionController reintroduced migrated building branch: ${token}`);
    }
  });

  if (!/CanvasActionDescriptorRegistry/.test(sources.dispatchRegistry)
      || !/dispatchDescriptorAction/.test(sources.dispatchRegistry)
      || !/resolveDescriptor/.test(sources.dispatchRegistry)) {
    violations.push('CanvasActionDispatchRegistry must route migrated actions through descriptors');
  }

  return {
    report: 'step5-action-descriptor-coverage',
    mode: 'blocking',
    requiredActions: REQUIRED_ACTIONS.map((item) => item.actionType),
    requiredDescriptorFields: [...REQUIRED_DESCRIPTOR_FIELDS],
    violations,
    summary: {
      totalViolations: violations.length,
    },
  };
}

function renderText(report) {
  const lines = [
    '[step5-action-descriptor-coverage] blocking gate',
    `required actions: ${report.requiredActions.join(', ')}`,
    `required descriptor fields: ${report.requiredDescriptorFields.join(', ')}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.violations.length > 0) {
    lines.push('', 'Blocked action descriptor regressions:');
    report.violations.forEach((violation) => lines.push(`- ${violation}`));
  } else {
    lines.push('passed');
  }
  return `${lines.join('\n')}\n`;
}

function parseFormat(argv = process.argv.slice(2)) {
  const unknown = argv.filter((arg) => arg !== '--json');
  if (unknown.length > 0) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

function main() {
  try {
    const format = parseFormat();
    const report = inspectStep5ActionDescriptorCoverage();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length > 0) process.exit(1);
  } catch (error) {
    console.error(`[step5-action-descriptor-coverage] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  REQUIRED_ACTIONS,
  REQUIRED_DESCRIPTOR_FIELDS,
  inspectStep5ActionDescriptorCoverage,
  parseFormat,
  renderText,
};
