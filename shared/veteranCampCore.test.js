const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./veteranCampCore');

// level-1 seed row: capacity 300, retention 12h, refundRatio 0.5
const ROW = { level: 1, capacity: 300, retentionHours: 12, refundRatio: 0.5 };
const H = core.HOUR_MS;

test('deposit parks soldiers up to capacity; overflow is reported for instant refund', () => {
  const r = core.deposit({ level: 1, batches: [] }, ROW, 500, 0);
  assert.equal(r.parkedSoldiers, 300); // capacity cap
  assert.equal(r.overflowSoldiers, 200); // caller refunds these immediately
  assert.equal(core.parkedTotal(r.camp), 300);
});

test('a level-0 / no-capacity camp overflows everything (preserves old instant-refund behavior)', () => {
  const r = core.deposit({ level: 0, batches: [] }, { capacity: 0, retentionHours: 0, refundRatio: 0.5 }, 120, 0);
  assert.equal(r.parkedSoldiers, 0);
  assert.equal(r.overflowSoldiers, 120);
});

test('parked soldiers drain linearly over retention; drained count is credited once', () => {
  const parked = core.deposit({ level: 1, batches: [] }, ROW, 240, 0).camp;

  // Half the retention -> half drained.
  const half = core.projectDrain(parked, ROW, 6 * H);
  assert.equal(half.drainedSoldiers, 120);
  assert.equal(core.parkedTotal(half.camp), 120);

  // Projecting again at the SAME time drains nothing more (idempotent).
  const again = core.projectDrain(half.camp, ROW, 6 * H);
  assert.equal(again.drainedSoldiers, 0);
  assert.equal(core.parkedTotal(again.camp), 120);

  // Past full retention -> fully drained, batch removed.
  const done = core.projectDrain(half.camp, ROW, 100 * H);
  assert.equal(done.drainedSoldiers, 120);
  assert.equal(core.parkedTotal(done.camp), 0);
  assert.equal(done.camp.batches.length, 0);
});

test('total drained across the whole lifetime equals the original deposit (no soldier lost/dup)', () => {
  let camp = core.deposit({ level: 1, batches: [] }, ROW, 200, 0).camp;
  let totalDrained = 0;
  for (let hour = 1; hour <= 12; hour += 1) {
    const step = core.projectDrain(camp, ROW, hour * H);
    totalDrained += step.drainedSoldiers;
    camp = step.camp;
  }
  assert.equal(totalDrained, 200);
  assert.equal(core.parkedTotal(camp), 0);
});

test('withdraw pulls soldiers back intact, oldest-batch-first, after draining to now', () => {
  let camp = core.deposit({ level: 1, batches: [] }, ROW, 100, 0).camp; // batch A @ t0
  camp = core.deposit(camp, ROW, 100, 2 * H).camp; // batch B @ t2h, A already drained ~16

  const w = core.withdraw(camp, ROW, 50, 2 * H);
  assert.equal(w.withdrawnSoldiers, 50);
  // A had 100 - floor(100*2/12)=100-16=84 left; withdrawing 50 oldest-first leaves 34 in A + 100 in B.
  assert.equal(core.parkedTotal(w.camp), 84 + 100 - 50);
});

test('withdraw is capped at what is actually parked', () => {
  const camp = core.deposit({ level: 1, batches: [] }, ROW, 40, 0).camp;
  const w = core.withdraw(camp, ROW, 999, 0);
  assert.equal(w.withdrawnSoldiers, 40);
  assert.equal(core.parkedTotal(w.camp), 0);
});

test('normalizeCamp is fail-safe on garbage input', () => {
  assert.deepEqual(core.normalizeCamp(null), { level: 0, batches: [] });
  assert.deepEqual(core.normalizeCamp({ batches: 'nope' }), { level: 0, batches: [] });
  const clamped = core.normalizeCamp({ level: 2, batches: [{ soldiers: 10, originalSoldiers: 5, atMs: -3 }] });
  assert.equal(clamped.level, 2);
  assert.equal(clamped.batches[0].soldiers, 5); // soldiers can't exceed original
  assert.equal(clamped.batches[0].atMs, 0); // negative time clamped
});
