// Single source for the "wild camp" world-combat content layer (P0 slice 1a).
//
// A pure constant module — NOT registered with the config pipeline. It carries no
// runtime state and no gameState reads; WorldCampSpawner consumes these tables to
// deterministically lay out respawning enemy camps around shared activity regions, and
// WorldCombatEncounterService consumes the loot/respawn fields when a camp is beaten.
//
// Design intent (mirrors docs/architecture/p0-combat-in-world-design-2026-07-05.md):
//   - Near-weak / far-strong: a camp's garrison = soldiersBase + soldiersPerRing * ring
//     (ring = Chebyshev distance from an activity-region anchor), so the difficulty gradient is a pure
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

// Placement parameters. All distances are Chebyshev rings measured from the activity-region
// anchor (the same metric the archetype gradient uses). Camps are global shared rows; activity
// regions only decide where the world should maintain encounter density.
const PLACEMENT = Object.freeze({
  // Player cities/field parties are grouped to stable anchors so nearby players share one camp
  // budget. This is not a per-player layer; overlapping activity sources reconcile to the same
  // world encounters.
  activityRegionSize: 8,
  // Do not place inside the immediate safe land around an activity source. The first possible camp
  // sits at ring 2.
  safeRadiusFromActivity: 1,
  // Minimum Chebyshev spacing between any two camps, so they do not clump on one tile
  // cluster.
  minSpacing: 2,
  // Per-active-region budgets by ring band:
  // every active region may maintain a small local ecology, and distant activity creates more
  // shared encounters without forking private player copies.
  ringBands: Object.freeze([
    Object.freeze({ minRing: 2, maxRing: 3, targetCamps: 3 }),
    Object.freeze({ minRing: 4, maxRing: 5, targetCamps: 2 }),
    Object.freeze({ minRing: 6, maxRing: 8, targetCamps: 1 }),
  ]),
});

// Ring → archetype band. Bands are inclusive lower bounds walked strongest-first so a
// far ring resolves to the strongest archetype whose band it reaches. Rings below the
// first band fall back to the weakest archetype (defensive; placement never emits a ring
// below the first placement band).
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
