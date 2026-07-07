const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./relationshipCore');
const ConfigTables = require('../../backend/config/ConfigTables');

const CFG = Object.fromEntries(
  ConfigTables.getRows('relationship_tuning').map((row) => [row.paramKey, row.value]),
);
const DAY = 24 * 60 * 60 * 1000;

test('config loads: relationship tuning params present', () => {
  assert.equal(CFG.friendAt, 40);
  assert.equal(CFG.nemesisAt, -80);
  assert.equal(CFG.maxEdgesPerPerson, 64);
});

test('resolveKind: affinity axis with meetCount gate + hysteresis', () => {
  assert.equal(core.resolveKind({ affinity: 10, meetCount: 5 }, CFG), 'acquaintance');
  assert.equal(core.resolveKind({ affinity: 50, meetCount: 5 }, CFG), 'friend');
  assert.equal(core.resolveKind({ affinity: 50, meetCount: 1 }, CFG), 'acquaintance'); // not enough meets
  assert.equal(core.resolveKind({ affinity: -50, meetCount: 1 }, CFG), 'enemy');
  // hysteresis: an existing friend stays friend just below the threshold.
  assert.equal(core.resolveKind({ kind: 'friend', affinity: 35, meetCount: 5 }, CFG), 'friend');
  assert.equal(core.resolveKind({ kind: 'friend', affinity: 20, meetCount: 5 }, CFG), 'acquaintance');
});

test('resolveKind: a special flag pins the kind regardless of affinity', () => {
  assert.equal(core.resolveKind({ affinity: -100, flags: ['sworn'] }, CFG), 'sworn');
  assert.equal(core.resolveKind({ affinity: 100, flags: ['rival_declared'] }, CFG), 'nemesis');
});

test('meet builds an acquaintance from compat, then increments + drifts toward compat', () => {
  const first = core.meet([], 'wp_b', 60, 1, 1000, CFG);
  assert.equal(first.edge.toPersonId, 'wp_b');
  assert.equal(first.edge.meetCount, 1);
  assert.equal(first.edge.affinity, Math.round(60 * CFG.initialFactor)); // 18
  assert.equal(first.edge.kind, 'acquaintance');
  // meeting again drifts affinity up toward the compat setpoint (60).
  const second = core.meet(first.edges, 'wp_b', 60, 1, 2000, CFG);
  assert.equal(second.edge.meetCount, 2);
  assert.ok(second.edge.affinity > first.edge.affinity && second.edge.affinity <= 60);
});

test('driftAffinity moves toward compat and clamps', () => {
  assert.ok(core.driftAffinity(0, 100, 1, 0, CFG) > 0);
  assert.ok(core.driftAffinity(0, -100, 1, 0, CFG) < 0);
  assert.equal(core.driftAffinity(100, 100, 1, 50, CFG), 100); // clamped
});

test('decayEdge bleeds an idle edge toward 0; special edges never decay', () => {
  const decayed = core.decayEdge({ affinity: 50, lastInteractAt: 0 }, 10 * DAY, CFG);
  assert.ok(decayed.affinity < 50 && decayed.affinity >= 0);
  const sworn = core.decayEdge({ affinity: 90, lastInteractAt: 0, flags: ['sworn'] }, 100 * DAY, CFG);
  assert.equal(sworn.affinity, 90); // 义兄弟不衰减
});

test('evictOverCap drops the weakest non-special edge when full', () => {
  const cfg = { ...CFG, maxEdgesPerPerson: 3 };
  const edges = [
    core.normalizeEdge({ toPersonId: 'a', affinity: 5, lastInteractAt: 1 }),
    core.normalizeEdge({ toPersonId: 'b', affinity: -2, lastInteractAt: 2 }), // weakest |affinity|
    core.normalizeEdge({ toPersonId: 'c', affinity: 90, lastInteractAt: 3, flags: ['sworn'] }),
    core.normalizeEdge({ toPersonId: 'd', affinity: 40, lastInteractAt: 4 }),
  ];
  core.evictOverCap(edges, cfg);
  assert.equal(edges.length, 3);
  assert.ok(!edges.some((e) => e.toPersonId === 'b')); // weakest evicted
  assert.ok(edges.some((e) => e.toPersonId === 'c')); // sworn kept
});

test('applyRelationEvent: swear/betray/reconcile transition special states (events only)', () => {
  let e = core.applyRelationEvent({ toPersonId: 'x', affinity: 60 }, 'swear', CFG);
  assert.equal(e.kind, 'sworn');
  assert.ok(e.affinity >= CFG.swornAt);
  // betrayal turns a sworn brother into a nemesis.
  e = core.applyRelationEvent(e, 'betray', CFG);
  assert.equal(e.kind, 'nemesis');
  assert.ok(!e.flags.includes('sworn'));
  assert.ok(e.affinity <= CFG.nemesisAt);
  // reconciliation clears the nemesis flag.
  e = core.applyRelationEvent(e, 'reconcile', CFG);
  assert.notEqual(e.kind, 'nemesis');
});

test('recruitModifier: friends/sworn in-faction help 招降, a nemesis hurts', () => {
  const edges = [
    core.normalizeEdge({ toPersonId: 'ally1', affinity: 85, flags: ['sworn'] }),
    core.normalizeEdge({ toPersonId: 'ally2', affinity: 50 }),
    core.normalizeEdge({ toPersonId: 'foe', affinity: -90, flags: ['rival_declared'] }),
  ];
  const kindOf = (id) => ({ ally1: 'sworn', ally2: 'friend', foe: 'nemesis' }[id] || null);
  // sworn(+0.40) with a nemesis(-0.30) in-faction => +0.10
  assert.ok(Math.abs(core.recruitModifier(edges, kindOf, CFG) - 0.10) < 1e-9);
  // no in-faction ties => 0
  assert.equal(core.recruitModifier(edges, () => null, CFG), 0);
});
