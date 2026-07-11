const fs = require('fs');
const path = require('path');

const DEFAULT_EXCLUSION_POLICY_PATH = path.join(
  __dirname,
  'playtest-tutorial-transcript-exclusions.json',
);

function loadExclusionPolicy(filePath = DEFAULT_EXCLUSION_POLICY_PATH) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed?.schema !== 'tutorial-playtest-transcript-exclusions/v1') {
    throw new Error(`Unsupported tutorial transcript exclusion policy: ${parsed?.schema || 'missing'}`);
  }
  return {
    ...parsed,
    exactFields: new Set(parsed.exactFields || []),
    fieldPatterns: (parsed.fieldPatterns || []).map((pattern) => new RegExp(pattern, 'i')),
  };
}

function isExcludedField(key, policy) {
  return policy.exactFields.has(key)
    || policy.fieldPatterns.some((pattern) => pattern.test(key));
}

function applyExclusionPolicy(value, policy) {
  if (Array.isArray(value)) {
    return value.map((entry) => applyExclusionPolicy(entry, policy));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isExcludedField(key, policy))
      .map(([key, entry]) => [key, applyExclusionPolicy(entry, policy)]),
  );
}

function readType(value) {
  return typeof value?.type === 'string' ? value.type : '';
}

function readPanelKey(...values) {
  for (const value of values) {
    const panelKey = value?.panelKey || value?.panel;
    if (typeof panelKey === 'string' && panelKey) return panelKey;
  }
  return '';
}

function buildTutorialTranscript(input = {}, options = {}) {
  const policy = options.policy || loadExclusionPolicy(options.policyPath);
  const reports = applyExclusionPolicy(input.verificationReports || [], policy);
  const evidence = applyExclusionPolicy(input.actionEvidence || [], policy);
  const evidenceByLabel = new Map(
    evidence.map((entry) => [String(entry?.label || '').replace(/-before$/, ''), entry]),
  );

  return reports.map((report) => {
    const matchingEvidence = evidenceByLabel.get(String(report?.label || '')) || null;
    const allowedAction = matchingEvidence?.highlight?.allowedAction || null;
    const targetAction = matchingEvidence?.target?.action || report?.action || null;
    return {
      stepKey: String(report?.beforeStepName || report?.stepName || ''),
      actionType: readType(allowedAction) || readType(report?.action),
      targetType: readType(targetAction),
      panelKey: readPanelKey(allowedAction, targetAction, report?.action),
    };
  });
}

function writeTutorialTranscript(filePath, input = {}, options = {}) {
  const transcript = buildTutorialTranscript(input, options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(transcript, null, 2)}\n`);
  return transcript;
}

module.exports = {
  DEFAULT_EXCLUSION_POLICY_PATH,
  applyExclusionPolicy,
  buildTutorialTranscript,
  loadExclusionPolicy,
  writeTutorialTranscript,
};
