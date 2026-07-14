'use strict';

const TaskPanelStepScripts = require('../frontend/js/tutorial-config/TaskPanelStepScripts');

const TRACE_SCHEMA = 'tutorial-step-script-trace/v1';

function getExpectedStepKeys() {
  return Object.keys(TaskPanelStepScripts);
}

function normalizeTrace(trace = {}) {
  const steps = trace && typeof trace.steps === 'object' && trace.steps !== null
    ? trace.steps
    : {};
  return {
    schema: String(trace?.schema || TRACE_SCHEMA),
    totalEvaluations: Number(trace?.totalEvaluations) || 0,
    steps,
  };
}

function buildStepScriptTraceReport(trace, expectedStepKeys = getExpectedStepKeys()) {
  const normalizedTrace = normalizeTrace(trace);
  const expected = [...expectedStepKeys];
  const expectedSet = new Set(expected);
  const observedStepKeys = Object.keys(normalizedTrace.steps).sort();
  const missingStepKeys = expected.filter(
    (stepKey) => !(Number(normalizedTrace.steps[stepKey]?.count) > 0),
  );
  const unexpectedStepKeys = observedStepKeys.filter((stepKey) => !expectedSet.has(stepKey));
  return {
    expectedStepKeys: expected,
    missingStepKeys,
    unexpectedStepKeys,
    passed: missingStepKeys.length === 0 && unexpectedStepKeys.length === 0,
    trace: normalizedTrace,
  };
}

module.exports = {
  TRACE_SCHEMA,
  buildStepScriptTraceReport,
  getExpectedStepKeys,
};
