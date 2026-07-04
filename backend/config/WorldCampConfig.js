// Single source for the "wild camp" world-combat content layer (P0 slice 1a).
//
// A pure constant module — NOT registered with the config pipeline. It carries no
// runtime state and no gameState reads; WorldCampSpawner consumes these tables to
// deterministically lay out respawning enemy camps around the capital, and
// WorldCombatEncounterService consumes the loot/respawn fields when a camp is beaten.
//
// Design intent (mirrors docs/architecture/p0-combat-in-world-design-2026-07-05.md):
//   - Near-weak / far-strong: a camp's garrison = soldiersBase + soldiersPerRing * ring
//     (ring = Chebyshev distance from the capital), so the difficulty gradient is a pure
//     function of placement, not extra config per tile.
//   - Each archetype owns its loot table and respawn cooldown so tuning is one-table.
//   - Removal is a rollback: nothing here mutates state; if WorldCampSpawner is never
//     called the single legacy stub is all that remains.

// Enemy camp prototypes, ordered weakest → strongest. getArchetypeForRing() selects by
// ring band, so the ring→archetype mapping stays here (single source) rather than being
// re-derived by callers. Loot tables use the canonical city resource keys (food/wood/
// knowledge/iron); iron is a valid city resource key (see TaskDefinitionShared) so far
// camps can pay out the scarcer resource.
const CAMP_ARCHETYPES = Object.freeze([
  Object.freeze({
    key: 'bandit',
    nameKey: 'world.combat.camp.bandit',
    quality: 'common',
    threatTier: 1,
    // Weak, near the capital: an early, low-risk farm.
    soldiersBase: 24,
    soldiersPerRing: 6,
    lootTable: Object.freeze({ food: 40, wood: 20 }),
    respawnCooldownMs: 20 * 60 * 1000, // 20 minutes
  }),
  Object.freeze({
    key: 'raiders',
    nameKey: 'world.combat.camp.raiders',
    quality: 'seasoned',
    threatTier: 2,
    soldiersBase: 40,
    soldiersPerRing: 10,
    lootTable: Object.freeze({ food: 60, wood: 45, knowledge: 15 }),
    respawnCooldownMs: 40 * 60 * 1000, // 40 minutes
  }),
  Object.freeze({
    key: 'warband',
    nameKey: 'world.combat.camp.warband',
    quality: 'elite',
    threatTier: 3,
    // Strong, far out: gates the better loot behind a real garrison.
    soldiersBase: 70,
    soldiersPerRing: 16,
    lootTable: Object.freeze({ food: 90, wood: 70, knowledge: 35, iron: 20 }),
    respawnCooldownMs: 90 * 60 * 1000, // 90 minutes
  }),
]);

// Placement parameters. All distances are Chebyshev rings measured from the capital
// coordinate (the same metric the archetype gradient uses).
const PLACEMENT = Object.freeze({
  // Do not place inside the player's starting safe land (reuses the spawn safe-ring
  // concept: START_SAFE_LAND_RADIUS is 1, so ring 1 stays camp-free) — the first camp
  // sits at ring 2.
  safeRadiusFromCapital: 1,
  minRingFromCapital: 2,
  maxRingFromCapital: 6,
  // Per-tile spawn threshold: roll01(...) < densityRoll ⇒ candidate. Kept low so the
  // world stays sparse (a handful of camps, not a minefield).
  densityRoll: 0.16,
  // Hard cap on live camps regardless of how many candidates the rings produce.
  maxCamps: 8,
  // Minimum Chebyshev spacing between any two camps, so they do not clump on one tile
  // cluster.
  minSpacing: 2,
});

// Ring → archetype band. Bands are inclusive lower bounds walked strongest-first so a
// far ring resolves to the strongest archetype whose band it reaches. Rings below the
// first band fall back to the weakest archetype (defensive; placement never emits a ring
// below minRingFromCapital).
const RING_ARCHETYPE_BANDS = Object.freeze([
  Object.freeze({ minRing: 5, key: 'warband' }),
  Object.freeze({ minRing: 4, key: 'raiders' }),
  Object.freeze({ minRing: 0, key: 'bandit' }),
]);

function getArchetypeByKey(key) {
  return CAMP_ARCHETYPES.find((archetype) => archetype.key === key) || CAMP_ARCHETYPES[0];
}

function getArchetypeForRing(ring) {
  const safeRing = Number.isFinite(Number(ring)) ? Math.floor(Number(ring)) : 0;
  const band =
    RING_ARCHETYPE_BANDS.find((entry) => safeRing >= entry.minRing) ||
    RING_ARCHETYPE_BANDS[RING_ARCHETYPE_BANDS.length - 1];
  return getArchetypeByKey(band.key);
}

module.exports = {
  CAMP_ARCHETYPES,
  PLACEMENT,
  RING_ARCHETYPE_BANDS,
  getArchetypeByKey,
  getArchetypeForRing,
};
