const test = require('node:test');
const assert = require('node:assert/strict');

const Eligibility = require('./formationDeploymentEligibility');

test('formation deployment blocks empty formations', () => {
  const result = Eligibility.evaluateFormationDeployment({ memberIds: [] });

  assert.equal(result.allowed, false);
  assert.equal(result.blockers[0].code, Eligibility.BLOCKER_EMPTY_FORMATION);
});

test('formation deployment blocks a primary general with zero soldiers', () => {
  const result = Eligibility.evaluateFormationDeployment({
    memberIds: ['hero-main', 'hero-deputy'],
    soldierAssignments: { 'hero-main': 0, 'hero-deputy': 80 },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.blockers[0].code, Eligibility.BLOCKER_PRIMARY_NO_SOLDIERS);
  assert.equal(result.primary.personId, 'hero-main');
});

test('formation deployment warns for zero-soldier deputies when primary can march', () => {
  const result = Eligibility.evaluateFormationDeployment({
    members: [
      { id: 'hero-main', name: 'Main', soldiersAssigned: 120 },
      { id: 'hero-deputy', name: 'Deputy', soldiersAssigned: 0 },
    ],
  });

  assert.equal(result.allowed, true);
  assert.equal(result.warnings[0].code, Eligibility.WARNING_DEPUTY_NO_SOLDIERS);
  assert.deepEqual(result.warnings[0].names, ['Deputy']);
});

test('formation deployment evaluates locked snapshots with the same combat failure mapping', () => {
  const snapshot = {
    members: [{ personId: 'hero-main', soldiersRemaining: 0 }],
  };

  const failure = Eligibility.getCombatDeploymentFailureForSnapshot(snapshot);

  assert.equal(failure.error, Eligibility.COMBAT_ERROR_PRIMARY_NO_SOLDIERS);
});

test('formation deployment maps march blockers to structured Chinese domain errors', () => {
  assert.deepEqual(
    Eligibility.getMarchDeploymentFailure({ memberIds: [] }),
    {
      success: false,
      error: 'FORMATION_EMPTY',
      message: '编队为空，无法出征',
      blocker: {
        code: 'FORMATION_EMPTY',
        messageKey: 'world.march.deploy.emptyFormation',
        participant: null,
        personId: '',
        name: '',
      },
    },
  );
  const primaryFailure = Eligibility.getMarchDeploymentFailure({
    memberIds: ['primary'],
    soldierAssignments: { primary: 0 },
  });
  assert.equal(primaryFailure.error, 'FORMATION_PRIMARY_NO_SOLDIERS');
  assert.equal(primaryFailure.message, '主将未配置士兵，无法出征');
});
