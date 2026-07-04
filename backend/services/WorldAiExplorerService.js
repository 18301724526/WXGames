const WorldMapService = require('./WorldMapService');
const WorldMarchCore = require('../../shared/worldMarchCore');
const { hashString } = require('../../shared/signatureHash');
const { toInteger } = require('../../shared/numberUtils');

const WORLD_AI_SCHEMA = 'world-ai-explorer-v1';
const DEFAULT_AI_FACTION_ID = 'ai-frontier';
const DEFAULT_AI_EXPLORER_ID = 'ai-frontier-1';
const DEFAULT_STEP_DURATION_MS = 15 * 1000;
const DEFAULT_SYNC_RADIUS = 1;
const DEFAULT_REVEAL_RADIUS = 0;
const MAX_ADVANCE_STEPS = 6;
const MAX_SYNC_TILES_PER_PASS = 64;
const DIRECTION_SEQUENCE = Object.freeze(['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']);

function toTimestamp(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (value instanceof Date) {
    const stamp = value.getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : fallback;
}

function createCoord(q, r) {
  return {
    q: toInteger(q, 0),
    r: toInteger(r, 0),
    tileId: WorldMapService.getTileId(q, r),
    canonicalId: WorldMapService.getCanonicalTileId(q, r),
  };
}

function getDefaultAiStart() {
  const width = WorldMapService.DEFAULT_WORLD_WIDTH;
  const height = WorldMapService.DEFAULT_WORLD_HEIGHT;
  return {
    q: Math.max(8, Math.floor(width / 2) - 8),
    r: Math.max(8, Math.floor(height / 2) - 8),
  };
}

function normalizeExplorer(rawExplorer = {}, now = new Date()) {
  const startedAt = rawExplorer.startedAt || now.toISOString();
  const position = rawExplorer.position && typeof rawExplorer.position === 'object'
    ? rawExplorer.position
    : getDefaultAiStart();
  const coord = createCoord(position.q ?? position.x, position.r ?? position.y);
  const revealedCanonicalIds = Array.from(new Set(
    (Array.isArray(rawExplorer.revealedCanonicalIds) ? rawExplorer.revealedCanonicalIds : [])
      .filter(Boolean)
      .map(String),
  ));
  const revealedTileIds = Array.from(new Set(
    (Array.isArray(rawExplorer.revealedTileIds) ? rawExplorer.revealedTileIds : [])
      .filter(Boolean)
      .map(String),
  ));
  return {
    id: typeof rawExplorer.id === 'string' && rawExplorer.id ? rawExplorer.id : DEFAULT_AI_EXPLORER_ID,
    factionId: typeof rawExplorer.factionId === 'string' && rawExplorer.factionId ? rawExplorer.factionId : DEFAULT_AI_FACTION_ID,
    position: coord,
    revealedTileIds,
    revealedCanonicalIds,
    stepDurationMs: Math.max(1000, toInteger(rawExplorer.stepDurationMs, DEFAULT_STEP_DURATION_MS)),
    nextStepAt: rawExplorer.nextStepAt || new Date(now.getTime() + DEFAULT_STEP_DURATION_MS).toISOString(),
    startedAt,
    updatedAt: rawExplorer.updatedAt || startedAt,
  };
}

function normalizeWorldAi(rawWorldAi = {}, now = new Date()) {
  const source = rawWorldAi && typeof rawWorldAi === 'object' ? rawWorldAi : {};
  const explorers = (Array.isArray(source.explorers) && source.explorers.length
    ? source.explorers
    : [{ id: DEFAULT_AI_EXPLORER_ID, factionId: DEFAULT_AI_FACTION_ID, position: getDefaultAiStart() }]
  ).map((explorer) => normalizeExplorer(explorer, now));
  return {
    schema: WORLD_AI_SCHEMA,
    version: 1,
    explorers,
    playerSyncedCanonicalIds: Array.from(new Set(
      (Array.isArray(source.playerSyncedCanonicalIds) ? source.playerSyncedCanonicalIds : [])
        .filter(Boolean)
        .map(String),
    )),
    lastAdvancedAt: source.lastAdvancedAt || now.toISOString(),
    updatedAt: source.updatedAt || now.toISOString(),
  };
}

function getTerrainPenalty(seed, coord) {
  const terrain = WorldMapService.chooseTerrain(seed, coord.q, coord.r);
  // Same water rule as player marches: ocean and river tiles are no-go; 'shore'
  // is plain marchable land (no penalty entry).
  if (WorldMarchCore.isMarchBlockedTerrain(terrain)) return 1000;
  if (terrain === 'mountain') return 8;
  return 0;
}

function getKnownCanonicalIds(worldAi = {}) {
  return new Set((worldAi.explorers || [])
    .flatMap((explorer) => Array.isArray(explorer.revealedCanonicalIds) ? explorer.revealedCanonicalIds : [])
    .filter(Boolean));
}

function pickNextStep(gameState, explorer, stepIndex = 0, now = new Date()) {
  const knownCanonicalIds = getKnownCanonicalIds(gameState.worldAi || {});
  const seed = gameState.worldMap?.seed || WorldMapService.ensureWorldMap(gameState, now).seed;
  const base = explorer.position || createCoord(0, 0);
  const candidates = DIRECTION_SEQUENCE.map((direction) => {
    const vector = WorldMapService.DIRECTION_VECTORS[direction];
    const q = toInteger(base.q, 0) + vector.q;
    const r = toInteger(base.r, 0) + vector.r;
    const canonicalId = WorldMapService.getCanonicalTileId(q, r);
    const novelty = knownCanonicalIds.has(canonicalId) ? 16 : 0;
    const roll = hashString(`${seed}|${explorer.id}|${q}|${r}|${stepIndex}|ai-explore`) / 4294967295;
    return {
      q,
      r,
      canonicalId,
      score: getTerrainPenalty(seed, { q, r }) + novelty - roll,
    };
  });
  return candidates.sort((a, b) => a.score - b.score || a.q - b.q || a.r - b.r)[0] || {
    q: base.q,
    r: base.r,
    canonicalId: WorldMapService.getCanonicalTileId(base.q, base.r),
  };
}

function revealAiArea(gameState, explorer, q, r, now = new Date()) {
  const coords = DEFAULT_REVEAL_RADIUS > 0
    ? WorldMapService.getRevealArea(q, r, DEFAULT_REVEAL_RADIUS)
    : [{ q, r }];
  const revealed = WorldMapService.revealTiles(gameState, coords, now, {
    overrides: {
    visibility: 'hidden',
    discovered: true,
    visible: false,
    intel: { level: 0 },
    discoveredBy: explorer.factionId,
    },
  });
  explorer.revealedTileIds = Array.from(new Set([
    ...(explorer.revealedTileIds || []),
    ...revealed.map((tile) => WorldMapService.getTileId(tile.q, tile.r)).filter(Boolean),
  ]));
  explorer.revealedCanonicalIds = Array.from(new Set([
    ...(explorer.revealedCanonicalIds || []),
    ...revealed.map((tile) => tile.canonicalId || WorldMapService.getCanonicalTileId(tile.q, tile.r)).filter(Boolean),
  ]));
  return revealed;
}

function getPlayerRevealedTiles(gameState) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  return (worldMap.tiles || []).filter((tile) => tile && tile.visible !== false && tile.visibility !== 'hidden');
}

function getAiTilesByCanonicalId(gameState) {
  const worldMap = WorldMapService.ensureWorldMap(gameState);
  const aiCanonicalIds = new Set((gameState.worldAi?.explorers || [])
    .flatMap((explorer) => explorer.revealedCanonicalIds || []));
  return new Map((worldMap.tiles || [])
    .filter((tile) => aiCanonicalIds.has(tile.canonicalId || WorldMapService.getCanonicalTileId(tile.q, tile.r)))
    .map((tile) => [tile.canonicalId || WorldMapService.getCanonicalTileId(tile.q, tile.r), tile]));
}

function findNearestPlayerTile(aiTile = {}, playerTiles = []) {
  return playerTiles
    .map((playerTile) => ({
      playerTile,
      distance: WorldMapService.getWrappedDistance(playerTile, aiTile),
    }))
    .sort((a, b) => a.distance - b.distance || a.playerTile.q - b.playerTile.q || a.playerTile.r - b.playerTile.r)[0]?.playerTile || null;
}

function syncAiRevealToPlayer(gameState, now = new Date(), options = {}) {
  const syncRadius = Math.max(0, toInteger(options.syncRadius, DEFAULT_SYNC_RADIUS));
  const playerTiles = getPlayerRevealedTiles(gameState);
  const aiTilesByCanonicalId = getAiTilesByCanonicalId(gameState);
  const synced = [];
  const syncedIds = new Set(gameState.worldAi?.playerSyncedCanonicalIds || []);
  const syncLimit = Math.max(1, toInteger(options.syncLimit, MAX_SYNC_TILES_PER_PASS));
  const candidates = [...aiTilesByCanonicalId.entries()]
    .filter(([canonicalId]) => !syncedIds.has(canonicalId))
    .map(([canonicalId, aiTile]) => {
      const nearestPlayerTile = findNearestPlayerTile(aiTile, playerTiles);
      return {
        canonicalId,
        aiTile,
        nearestPlayerTile,
        distance: nearestPlayerTile
          ? WorldMapService.getWrappedDistance(nearestPlayerTile, aiTile)
          : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((candidate) => candidate.nearestPlayerTile && candidate.distance <= syncRadius)
    .sort((a, b) => a.distance - b.distance || a.aiTile.q - b.aiTile.q || a.aiTile.r - b.aiTile.r);
  for (const { canonicalId, aiTile, nearestPlayerTile } of candidates) {
    if (synced.length >= syncLimit) break;
    const delta = WorldMapService.getWrappedDelta(nearestPlayerTile, aiTile);
    const displayQ = toInteger(nearestPlayerTile.q, 0) + delta.q;
    const displayR = toInteger(nearestPlayerTile.r, 0) + delta.r;
    synced.push({
      q: displayQ,
      r: displayR,
      overrides: {
        terrain: aiTile.terrain,
        riverPorts: aiTile.riverPorts,
        oceanTemplates: aiTile.oceanTemplates,
        transitionKey: aiTile.transitionKey,
        generatedAt: aiTile.generatedAt,
        visibility: 'scouted',
        visible: true,
        discovered: true,
        intel: { level: 1, knownTerrain: true },
        syncedFromFactionId: DEFAULT_AI_FACTION_ID,
      },
    });
    syncedIds.add(canonicalId);
  }
  const revealed = WorldMapService.revealTiles(gameState, synced, now);
  gameState.worldAi.playerSyncedCanonicalIds = Array.from(syncedIds);
  if (revealed.length) gameState.worldAi.updatedAt = now.toISOString();
  return revealed;
}

function advanceAiExploration(gameState, now = new Date(), options = {}) {
  WorldMapService.ensureWorldMap(gameState, now);
  gameState.worldAi = normalizeWorldAi(gameState.worldAi, now);
  const nowMs = now.getTime();
  const revealed = [];
  for (const explorer of gameState.worldAi.explorers) {
    let nextStepAtMs = toTimestamp(explorer.nextStepAt, nowMs + explorer.stepDurationMs);
    let advanced = 0;
    while (nextStepAtMs <= nowMs && advanced < MAX_ADVANCE_STEPS) {
      const next = pickNextStep(gameState, explorer, advanced, now);
      explorer.position = createCoord(next.q, next.r);
      revealed.push(...revealAiArea(gameState, explorer, next.q, next.r, now));
      explorer.updatedAt = now.toISOString();
      nextStepAtMs += explorer.stepDurationMs;
      advanced += 1;
    }
    explorer.nextStepAt = new Date(nextStepAtMs).toISOString();
  }
  const synced = syncAiRevealToPlayer(gameState, now, options);
  gameState.worldAi.lastAdvancedAt = now.toISOString();
  gameState.worldAi.updatedAt = now.toISOString();
  return { revealed, synced };
}

function normalizeWorldAiState(gameState, now = new Date()) {
  WorldMapService.ensureWorldMap(gameState, now);
  gameState.worldAi = normalizeWorldAi(gameState.worldAi, now);
  return gameState.worldAi;
}

module.exports = {
  DEFAULT_AI_EXPLORER_ID,
  DEFAULT_AI_FACTION_ID,
  DEFAULT_REVEAL_RADIUS,
  DEFAULT_STEP_DURATION_MS,
  DEFAULT_SYNC_RADIUS,
  MAX_ADVANCE_STEPS,
  MAX_SYNC_TILES_PER_PASS,
  WORLD_AI_SCHEMA,
  advanceAiExploration,
  normalizeExplorer,
  normalizeWorldAi,
  normalizeWorldAiState,
  pickNextStep,
  revealAiArea,
  syncAiRevealToPlayer,
};
