const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchVerification = require('../services/worldExplorer/WorldMarchVerification');

function makeMission(overrides = {}) {
  return {
    id: 'march-verify-1',
    status: 'active',
    mode: 'manual',
    origin: { q: 0, r: 0 },
    target: { q: 4, r: 0 },
    position: { q: 0, r: 0 },
    route: [
      { q: 1, r: 0, step: 1, revealed: false },
      { q: 2, r: 0, step: 2, revealed: false },
      { q: 3, r: 0, step: 3, revealed: false },
      { q: 4, r: 0, step: 4, revealed: false },
    ],
    stepDurationMs: 1000,
    startedAt: '2026-06-21T00:00:00.000Z',
    nextStepAt: '2026-06-21T00:00:01.000Z',
    completesAt: '2026-06-21T00:00:04.000Z',
    ...overrides,
  };
}

test('WorldMarchVerification reports consistent client position without overlay', () => {
  const now = new Date('2026-06-21T00:00:02.000Z');
  const mission = makeMission();
  const report = WorldMarchVerification.sanitizeReport(
    {
      missionId: mission.id,
      clientTime: now.toISOString(),
      position: { q: 2, r: 0 },
    },
    now,
  );

  const result = WorldMarchVerification.verifyMission(mission, report, now);

  assert.equal(result.status, 'aligned');
  assert.equal(result.severity, 'none');
  assert.equal(result.diffTiles, 0);
});

test('WorldMarchVerification treats slight client jitter as quiet alignment', () => {
  const now = new Date('2026-06-21T00:00:02.000Z');
  const mission = makeMission();
  const report = WorldMarchVerification.sanitizeReport(
    {
      missionId: mission.id,
      clientTime: now.toISOString(),
      position: { q: 2.4, r: 0 },
    },
    now,
  );

  const result = WorldMarchVerification.verifyMission(mission, report, now);

  assert.equal(result.status, 'aligned');
  assert.equal(result.severity, 'none');
  assert.equal(result.diffTiles, 0.3999999999999999);
});

test('WorldMarchVerification flags client fast-forward as pullback drift', () => {
  const now = new Date('2026-06-21T00:00:02.000Z');
  const mission = makeMission();
  const report = WorldMarchVerification.sanitizeReport(
    {
      missionId: mission.id,
      clientTime: now.toISOString(),
      position: { q: 8, r: 0 },
    },
    now,
  );

  const result = WorldMarchVerification.verifyMission(mission, report, now);

  assert.equal(result.status, 'pullback-required');
  assert.equal(result.severity, 'large');
  assert.equal(result.diffTiles, 6);
});
