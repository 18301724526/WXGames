const test = require('node:test');
const assert = require('node:assert/strict');

const sharedEligibility = require('../../../shared/formationDeploymentEligibility');

test('FormationDeploymentEligibilityAdapter exposes the canonical shared module in CommonJS mode', () => {
  const modulePath = require.resolve('./FormationDeploymentEligibilityAdapter');
  const previousGlobal = globalThis.FormationDeploymentEligibility;
  delete require.cache[modulePath];
  delete globalThis.FormationDeploymentEligibility;

  try {
    const adapter = require('./FormationDeploymentEligibilityAdapter');
    assert.equal(adapter, sharedEligibility);
    assert.equal(globalThis.FormationDeploymentEligibility, sharedEligibility);
  } finally {
    delete require.cache[modulePath];
    if (previousGlobal) globalThis.FormationDeploymentEligibility = previousGlobal;
    else delete globalThis.FormationDeploymentEligibility;
  }
});
