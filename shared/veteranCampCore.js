// veteranCampCore — pure rules for the 老兵营地 (veteran camp) DISMISSAL regret-buffer.
//
// When soldiers are dismissed from a formation they are PARKED here instead of vanishing.
// Each parked batch drains LINEARLY over retentionHours; every drained soldier pays back a
// fraction (refundRatio) of its recruitment value — this is where the old instant "卸兵退50%粮"
// now lives, paid out over time. While still parked, soldiers can be withdrawn back into the
// city intact (the "regret" undo). Overflow beyond capacity drains immediately.
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

// A parked batch remembers its deposit time + original size so linear drain is reproducible
// no matter how often projectDrain runs (idempotent between the same two timestamps).
function normalizeBatch(raw) {
  const originalSoldiers = toNonNegativeInt(raw?.originalSoldiers ?? raw?.soldiers);
  const soldiers = Math.min(originalSoldiers, toNonNegativeInt(raw?.soldiers ?? originalSoldiers));
  const atMs = toNonNegativeInt(raw?.atMs);
  return { soldiers, originalSoldiers, atMs };
}

function normalizeCamp(raw, level) {
  const batches = Array.isArray(raw?.batches)
    ? raw.batches.map(normalizeBatch).filter((batch) => batch.soldiers > 0)
    : [];
  const resolvedLevel = level == null ? toNonNegativeInt(raw?.level) : toNonNegativeInt(level);
  return { level: resolvedLevel, batches };
}

function parkedTotal(camp) {
  return normalizeCamp(camp).batches.reduce((sum, batch) => sum + batch.soldiers, 0);
}

function retentionMsOf(row) {
  return Math.max(0, toNumber(row?.retentionHours, 0)) * HOUR_MS;
}

function capacityOf(row) {
  return toNonNegativeInt(row?.capacity);
}

// How many of a batch's ORIGINAL soldiers have drained by `nowMs` (linear over retention).
function drainedByNow(batch, retentionMs, nowMs) {
  if (batch.originalSoldiers <= 0) return batch.originalSoldiers;
  if (retentionMs <= 0) return batch.originalSoldiers; // no retention -> drains instantly
  const elapsed = Math.max(0, toNumber(nowMs, 0) - batch.atMs);
  const ratio = Math.min(1, elapsed / retentionMs);
  return Math.min(batch.originalSoldiers, Math.floor(batch.originalSoldiers * ratio));
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
    const drainedTotal = drainedByNow(batch, retentionMs, nowMs);
    const remaining = Math.max(0, batch.originalSoldiers - drainedTotal);
    drainedSoldiers += Math.max(0, batch.soldiers - remaining);
    if (remaining > 0) batches.push({ ...batch, soldiers: remaining });
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
  if (parked > 0) batches.push({ soldiers: parked, originalSoldiers: parked, atMs: toNonNegativeInt(nowMs) });
  return {
    camp: { level: drained.camp.level, batches },
    parkedSoldiers: parked,
    overflowSoldiers,
    drainedSoldiers: drained.drainedSoldiers,
  };
}

// Withdraw up to `soldiers` back out of the camp, intact (the regret undo). Drains first, then
// pulls oldest-batch-first so the soldiers closest to draining are the ones rescued.
function withdraw(camp, row, soldiers, nowMs) {
  const drained = projectDrain(camp, row, nowMs);
  let want = toNonNegativeInt(soldiers);
  let withdrawnSoldiers = 0;
  const batches = [];
  for (const batch of drained.camp.batches) {
    if (want <= 0) {
      batches.push(batch);
      continue;
    }
    const take = Math.min(want, batch.soldiers);
    want -= take;
    withdrawnSoldiers += take;
    const remaining = batch.soldiers - take;
    if (remaining > 0) batches.push({ ...batch, soldiers: remaining });
  }
  return {
    camp: { level: drained.camp.level, batches },
    withdrawnSoldiers,
    drainedSoldiers: drained.drainedSoldiers,
  };
}

module.exports = {
  HOUR_MS,
  normalizeCamp,
  parkedTotal,
  capacityOf,
  retentionMsOf,
  projectDrain,
  deposit,
  withdraw,
};
