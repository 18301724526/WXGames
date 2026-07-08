// veteranCampCore — pure rules for the 老兵营地 (veteran camp) DISMISSAL regret-buffer.
//
// When soldiers are dismissed from a formation they are PARKED here instead of vanishing.
// Each parked batch drains LINEARLY over retentionHours; every drained soldier pays back a
// fraction (refundRatio) of its recruitment value — this is where the old instant "卸兵退50%粮"
// now lives, paid out over time. While still parked, soldiers can be withdrawn back into the
// city intact (the "regret" undo). Overflow beyond capacity drains immediately.
//
// A batch is canonical as { originalSoldiers, atMs, drained, withdrawn }: parked = original −
// drained − withdrawn. Tracking drained and withdrawn SEPARATELY is what makes withdraw safe —
// the time-based drain schedule keys off `originalSoldiers`/`atMs` (never mutated), so pulling
// soldiers out never resurrects on the next projection. Returned batches also carry a derived
// `soldiers` (= current parked) for convenience; it is recomputed, never a source of truth.
//
// This core is PURE: it only moves soldier COUNTS over time. The config row (capacity /
// retentionHours / refundRatio) and the grain-per-soldier conversion are supplied by the
// caller (a service reads ConfigTables + FormationStrengthService and applies the refund),
// so the same rules run identically on server, worker heartbeat, and tests.

const HOUR_MS = 60 * 60 * 1000;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toInteger(value, fallback = 0) {
  const number = toNumber(value, fallback);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function toNonNegativeInt(value) {
  return Math.max(0, toInteger(value, 0));
}

// Canonical batch: original size + deposit time + cumulative drained + cumulative withdrawn.
// Legacy shape { soldiers, originalSoldiers } is read too: a raw `soldiers` below `original`
// is treated as already-withdrawn so old saves keep their parked count.
function normalizeBatch(raw) {
  const originalSoldiers = toNonNegativeInt(raw?.originalSoldiers ?? raw?.soldiers);
  const atMs = toNonNegativeInt(raw?.atMs);
  const drained = Math.min(originalSoldiers, toNonNegativeInt(raw?.drained));
  let withdrawn = toNonNegativeInt(raw?.withdrawn);
  if (raw?.withdrawn == null && raw?.soldiers != null && raw?.originalSoldiers != null) {
    // Legacy round-trip: infer withdrawn from the gap between original and the stored parked count.
    withdrawn = Math.max(0, originalSoldiers - drained - toNonNegativeInt(raw.soldiers));
  }
  withdrawn = Math.min(withdrawn, Math.max(0, originalSoldiers - drained));
  const parked = Math.max(0, originalSoldiers - drained - withdrawn);
  return { originalSoldiers, atMs, drained, withdrawn, soldiers: parked };
}

function normalizeCamp(raw, level) {
  const batches = Array.isArray(raw?.batches)
    ? raw.batches.map(normalizeBatch).filter((batch) => batch.soldiers > 0)
    : [];
  const resolvedLevel = level == null ? toNonNegativeInt(raw?.level) : toNonNegativeInt(level);
  return { level: resolvedLevel, batches };
}

function batchParked(batch) {
  return Math.max(0, batch.originalSoldiers - batch.drained - batch.withdrawn);
}

function parkedTotal(camp) {
  return normalizeCamp(camp).batches.reduce((sum, batch) => sum + batchParked(batch), 0);
}

function retentionMsOf(row) {
  return Math.max(0, toNumber(row?.retentionHours, 0)) * HOUR_MS;
}

function capacityOf(row) {
  return toNonNegativeInt(row?.capacity);
}

// Cumulative soldiers the drain schedule has claimed from a batch by `nowMs` (linear over
// retention from the ORIGINAL size), capped so drain never eats soldiers already withdrawn.
function scheduledDrain(batch, retentionMs, nowMs) {
  const withdrawable = Math.max(0, batch.originalSoldiers - batch.withdrawn);
  if (batch.originalSoldiers <= 0) return 0;
  if (retentionMs <= 0) return withdrawable; // no retention -> drains instantly
  const elapsed = Math.max(0, toNumber(nowMs, 0) - batch.atMs);
  const ratio = Math.min(1, elapsed / retentionMs);
  return Math.min(withdrawable, Math.floor(batch.originalSoldiers * ratio));
}

// Advance drain to `nowMs`. Returns the updated camp + the number of soldiers that drained
// since the last projection (the caller converts that count into a grain refund). Idempotent:
// calling twice with the same nowMs drains nothing the second time.
function projectDrain(camp, row, nowMs) {
  const normalized = normalizeCamp(camp);
  const retentionMs = retentionMsOf(row);
  let drainedSoldiers = 0;
  const batches = [];
  for (const batch of normalized.batches) {
    const targetDrained = Math.max(batch.drained, scheduledDrain(batch, retentionMs, nowMs));
    drainedSoldiers += Math.max(0, targetDrained - batch.drained);
    const next = { ...batch, drained: targetDrained };
    next.soldiers = batchParked(next);
    if (next.soldiers > 0) batches.push(next);
  }
  return { camp: { level: normalized.level, batches }, drainedSoldiers };
}

// Park dismissed soldiers. Anything over remaining capacity is `overflowSoldiers` (the caller
// refunds those immediately at the same refundRatio — a level-0 / capacity-0 camp overflows
// everything, preserving the old instant-refund behavior).
function deposit(camp, row, soldiers, nowMs) {
  const drained = projectDrain(camp, row, nowMs);
  const incoming = toNonNegativeInt(soldiers);
  const capacity = capacityOf(row);
  const free = Math.max(0, capacity - parkedTotal(drained.camp));
  const parked = Math.min(incoming, free);
  const overflowSoldiers = incoming - parked;
  const batches = drained.camp.batches.slice();
  if (parked > 0) {
    batches.push({
      originalSoldiers: parked, atMs: toNonNegativeInt(nowMs), drained: 0, withdrawn: 0, soldiers: parked,
    });
  }
  return {
    camp: { level: drained.camp.level, batches },
    parkedSoldiers: parked,
    overflowSoldiers,
    drainedSoldiers: drained.drainedSoldiers,
  };
}

// Withdraw up to `soldiers` back out of the camp, intact (the regret undo). Drains first, then
// pulls oldest-batch-first so the soldiers closest to draining are the ones rescued. Withdrawn
// soldiers are booked against the batch's `withdrawn` tally, never resurrected by later drains.
function withdraw(camp, row, soldiers, nowMs) {
  const drained = projectDrain(camp, row, nowMs);
  let want = toNonNegativeInt(soldiers);
  let withdrawnSoldiers = 0;
  const batches = [];
  for (const batch of drained.camp.batches) {
    const parked = batchParked(batch);
    if (want <= 0 || parked <= 0) {
      if (parked > 0) batches.push(batch);
      continue;
    }
    const take = Math.min(want, parked);
    want -= take;
    withdrawnSoldiers += take;
    const next = { ...batch, withdrawn: batch.withdrawn + take };
    next.soldiers = batchParked(next);
    if (next.soldiers > 0) batches.push(next);
  }
  return {
    camp: { level: drained.camp.level, batches },
    withdrawnSoldiers,
    drainedSoldiers: drained.drainedSoldiers,
  };
}

// Milliseconds until a batch fully drains (its parked soldiers reach 0 on the schedule).
function batchDrainEtaMs(batch, row, nowMs) {
  const retentionMs = retentionMsOf(row);
  const deadline = toNonNegativeInt(batch?.atMs) + retentionMs;
  return Math.max(0, deadline - toNumber(nowMs, 0));
}

module.exports = {
  HOUR_MS,
  normalizeCamp,
  batchParked,
  parkedTotal,
  capacityOf,
  retentionMsOf,
  batchDrainEtaMs,
  projectDrain,
  deposit,
  withdraw,
};
