const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inspectStep5ActionDescriptorCoverage,
  parseFormat,
} = require('./check-step5-action-descriptor-coverage');

const liveRegistry = require('../frontend/js/platform/CanvasActionDescriptorRegistry');

function makeRegistry(mutator = (descriptor) => descriptor) {
  return {
    resolve(action = {}) {
      const descriptor = liveRegistry.resolve(action);
      return descriptor ? mutator({ ...descriptor }) : null;
    },
    buildPayload(action = {}) {
      return liveRegistry.buildPayload(action);
    },
  };
}

test('Step5 action descriptor coverage accepts the live building slice', () => {
  const report = inspectStep5ActionDescriptorCoverage();

  assert.equal(report.summary.totalViolations, 0);
});

test('Step5 action descriptor FIRE: missing descriptor metadata is blocked', () => {
  const report = inspectStep5ActionDescriptorCoverage({
    registry: makeRegistry((descriptor) => {
      if (descriptor.actionType === 'buildBuilding') delete descriptor.payloadBuilder;
      return descriptor;
    }),
    sources: {
      controller: '',
      dispatchRegistry: 'CanvasActionDescriptorRegistry dispatchDescriptorAction resolveDescriptor',
    },
  });

  assert.ok(report.violations.includes('buildBuilding descriptor missing payloadBuilder'));
});

test('Step5 action descriptor FIRE: payload builder drift is blocked', () => {
  const report = inspectStep5ActionDescriptorCoverage({
    registry: {
      resolve: liveRegistry.resolve,
      buildPayload(action = {}) {
        if (action.type === 'upgradeBuilding') return { target: action.buildingId };
        return liveRegistry.buildPayload(action);
      },
    },
    sources: {
      controller: '',
      dispatchRegistry: 'CanvasActionDescriptorRegistry dispatchDescriptorAction resolveDescriptor',
    },
  });

  assert.ok(report.violations.includes('upgradeBuilding payloadBuilder must emit { buildingId }'));
});

test('Step5 action descriptor FIRE: controller branch reintroduction is blocked', () => {
  const report = inspectStep5ActionDescriptorCoverage({
    sources: {
      controller: "switch (action.type) { case 'buildBuilding': return this.handle_buildBuilding; }",
      dispatchRegistry: 'CanvasActionDescriptorRegistry dispatchDescriptorAction resolveDescriptor',
    },
  });

  assert.ok(report.violations.some((violation) => violation.includes("case 'buildBuilding'")));
  assert.ok(report.violations.some((violation) => violation.includes('handle_buildBuilding')));
});

test('Step5 action descriptor coverage rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--summary']), /unknown arguments/);
});
