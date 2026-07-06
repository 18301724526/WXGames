const test = require('node:test');
const assert = require('node:assert/strict');

const resolver = require('../services/territory/GarrisonCaptureResolver');

const NOW = new Date('2026-07-06T00:00:00Z');

function captive(id = 'df_1') {
  return {
    id,
    name: '林烈',
    title: '林地骁将',
    quality: 'good',
    attributes: { charisma: 40, command: 60, force: 70, intelligence: 50, politics: 40, speed: 55 },
    personality: { nature: 'valiant', axes: { boldness: 0.6, sociability: 0.1, integrity: 0.2 } },
    relationships: [],
  };
}

function ruler() {
  return {
    id: 'ruler_1', name: '主公', source: { type: 'ruler' },
    quality: 'great', attributes: { charisma: 80, command: 70, force: 60, intelligence: 70, politics: 70, speed: 50 },
    personality: { nature: 'dutiful', axes: { boldness: 0.1, sociability: 0.0, integrity: 0.9 } },
    relationships: [],
  };
}

function makeState(overrides = {}) {
  return { playerId: 'p1', famousPeople: [ruler()], captureDecisions: [], ...overrides };
}
function territory(captureChance) {
  return {
    id: 't_57_12', cityName: '林城',
    garrison: { captureChance, recruitBaseRate: 0.5, leader: captive() },
  };
}
const mission = { id: 'm_1' };

test('safe/undefended band (captureChance 0) never captures — occupy path untouched', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(0), mission, NOW);
  assert.equal(d, null);
  assert.deepEqual(gs.captureDecisions, []);
});

test('a captured defender stages a pending decision with a recruit chance', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(1), mission, NOW); // captureChance 1 => always
  assert.ok(d);
  assert.equal(d.status, 'pending');
  assert.equal(d.captive.id, 'df_1');
  assert.ok(d.recruitChance >= 0 && d.recruitChance <= 0.9);
  assert.equal(gs.captureDecisions.length, 1);
  assert.equal(gs.captureDecisions[0].id, d.id);
});

test('execute drops the captive; roster unchanged; decision resolved', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(1), mission, NOW);
  const before = gs.famousPeople.length;
  const r = resolver.resolveCaptureDecision(gs, d.id, 'execute', NOW);
  assert.equal(r.success, true);
  assert.equal(r.outcome.kind, 'executed');
  assert.equal(r.recruited, null);
  assert.equal(gs.famousPeople.length, before);
  assert.equal(gs.captureDecisions[0].status, 'resolved');
});

test('recruit success adds the captive to the roster (deterministic via forced chance)', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(1), mission, NOW);
  d.recruitChance = 1; // any recruitRoll in [0,1) < 1 => success, regardless of seed
  const before = gs.famousPeople.length;
  const r = resolver.resolveCaptureDecision(gs, d.id, 'recruit', NOW);
  assert.equal(r.outcome.kind, 'recruited');
  assert.equal(gs.famousPeople.length, before + 1);
  assert.ok(gs.famousPeople.some((p) => p.id === 'df_1'));
  assert.equal(r.recruited.source.type, 'capture');
});

test('recruit failure (forced chance 0) refuses — 宁死不降, roster unchanged', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(1), mission, NOW);
  d.recruitChance = 0;
  const before = gs.famousPeople.length;
  const r = resolver.resolveCaptureDecision(gs, d.id, 'recruit', NOW);
  assert.equal(r.outcome.kind, 'recruitRefused');
  assert.equal(gs.famousPeople.length, before);
});

test('release grants 仁德 favor and drops the captive', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(1), mission, NOW);
  const r = resolver.resolveCaptureDecision(gs, d.id, 'release', NOW);
  assert.equal(r.outcome.kind, 'released');
  assert.ok(r.outcome.homeFactionFavor > 0);
  assert.equal(gs.famousPeople.length, 1); // just the ruler
});

test('the recruit roll is deterministic from the stored seed (no reload-to-reroll)', () => {
  const a = makeState();
  const da = resolver.maybeCaptureOnVictory(a, territory(1), mission, NOW);
  const ra = resolver.resolveCaptureDecision(a, da.id, 'recruit', NOW);
  const b = makeState();
  const db = resolver.maybeCaptureOnVictory(b, territory(1), mission, NOW);
  const rb = resolver.resolveCaptureDecision(b, db.id, 'recruit', NOW);
  assert.equal(ra.outcome.kind, rb.outcome.kind); // same seed => same outcome
});

test('resolving an unknown or already-resolved decision errors', () => {
  const gs = makeState();
  const d = resolver.maybeCaptureOnVictory(gs, territory(1), mission, NOW);
  resolver.resolveCaptureDecision(gs, d.id, 'execute', NOW);
  const again = resolver.resolveCaptureDecision(gs, d.id, 'recruit', NOW);
  assert.equal(again.success, false);
  assert.equal(resolver.resolveCaptureDecision(gs, 'nope', 'execute', NOW).success, false);
});
