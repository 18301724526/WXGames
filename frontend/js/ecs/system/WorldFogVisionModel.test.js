const test = require('node:test');
const assert = require('node:assert/strict');

require('../foundation/WorldTime');
require('./WorldMarchProgressSnapshot');
require('./WorldMarchSystem');
const WorldFogVisionModel = require('./WorldFogVisionModel');
const WorldMarchCore = require('../../../../shared/worldMarchCore');

const GEOMETRY = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
const VIEWPORT = { originX: 0, originY: 0, scale: 1 };

function createTiles() {
  return [
    { id: 'tile_0_0', q: 0, r: 0, visibility: 'controlled', discovered: true, visible: true },
    { id: 'tile_1_0', q: 1, r: 0, visibility: 'explored', discovered: true, visible: false },
    { id: 'tile_2_0', q: 2, r: 0, visibility: 'unknown', discovered: false, visible: false },
    { id: 'tile_3_0', q: 3, r: 0, visibility: 'unknown', discovered: false, visible: false },
  ];
}

function createMission(overrides = {}) {
  const startedAt = Date.parse('2026-07-04T00:00:00.000Z');
  return {
    id: 'fog-vision-mission-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: false },
      { q: 3, r: 0, tileId: 'tile_3_0', step: 3, revealed: false },
    ],
    target: { q: 3, r: 0, tileId: 'tile_3_0' },
    startedAt: new Date(startedAt).toISOString(),
    stepDurationMs: 10000,
    revealedTileIds: ['tile_1_0'],
    ...overrides,
  };
}

function missionStartMs(mission) {
  return Date.parse(mission.startedAt);
}

// Today the fog chain reads reveal data baked onto the mission by upstream snapshot
// producers; the fog-facts surgery replaces that with an on-the-spot computation from
// (mission, nowMs). Baking core-computed values here makes the fixture equivalent in
// both worlds, so these tests lock observable fog behavior across the surgery.
function withBakedReveal(mission, nowMs) {
  return {
    ...mission,
    renderRevealSources: WorldMarchCore.getRouteRenderRevealSources(mission, nowMs),
    renderRevealSignature: WorldMarchCore.getRouteRenderRevealSignature(mission, nowMs),
  };
}

function collectMissionSources(mission, nowMs) {
  return WorldFogVisionModel.collectSources(
    {
      tileMapView: {
        tiles: createTiles(),
        activeScouts: [withBakedReveal(mission, nowMs)],
      },
      viewport: VIEWPORT,
      geometry: GEOMETRY,
    },
    { nowMs },
  );
}

function summarizeSources(sources) {
  return sources
    .map((source) => ({
      q: Math.round(source.q * 100) / 100,
      r: Math.round(source.r * 100) / 100,
      strength: Math.round((source.strength ?? 1) * 1000) / 1000,
    }))
    .sort((a, b) => a.q - b.q || a.r - b.r || a.strength - b.strength);
}

test('vision history memory sources survive without any march reveal data', () => {
  const collected = WorldFogVisionModel.collectSources(
    {
      tileMapView: {
        tiles: createTiles(),
        visionHistory: {
          sources: [
            { kind: 'unit', q: 2, r: 1 },
            { kind: 'city', q: 0, r: 0 },
          ],
        },
      },
      viewport: VIEWPORT,
      geometry: GEOMETRY,
    },
    {},
  );

  assert.equal(collected.visionHistorySources.length, 2);
  const kinds = collected.visionHistorySources.map((source) => source.kind).sort();
  assert.deepEqual(kinds, ['city', 'unit']);
  assert.equal(collected.memorySources, collected.visionHistorySources);
  collected.visionHistorySources.forEach((source) => {
    assert.equal(Number.isFinite(source.center.x), true);
    assert.equal(Number.isFinite(source.center.y), true);
  });
});

test('march reveal fog follows mission progress: frontier at partial strength', () => {
  const mission = createMission();
  const nowMs = missionStartMs(mission) + 15000; // segment 1 done, segment 2 halfway
  const collected = collectMissionSources(mission, nowMs);
  const sources = collected.visionHistorySources;

  assert.equal(sources.length > 0, true);
  sources.forEach((source) => {
    const strength = source.strength ?? 1;
    assert.equal(strength >= 0 && strength <= 1, true);
  });
  const maxQ = Math.max(...sources.map((source) => source.q));
  assert.equal(Math.abs(maxQ - 2) < 0.01, true, `frontier must stop at q=2, got ${maxQ}`);
  const frontier = sources.find((source) => Math.abs(source.q - 2) < 0.01);
  assert.equal(frontier.strength > 0 && frontier.strength < 1, true);
  // Note: identity dedup is last-write-wins, so the exact q=1 point is overwritten by the
  // weaker frontier-segment sample; the revealed stretch is still covered at full strength.
  const fullStrength = sources.filter((source) => source.strength === 1 && source.q <= 1.01);
  assert.equal(fullStrength.length > 0, true);
});

test('march reveal fog is a function of time: later frame reveals strictly more', () => {
  const mission = createMission();
  const early = collectMissionSources(mission, missionStartMs(mission) + 12000);
  const later = collectMissionSources(mission, missionStartMs(mission) + 18000);

  const earlyFrontier = early.visionHistorySources.find((s) => Math.abs(s.q - 2) < 0.01);
  const laterFrontier = later.visionHistorySources.find((s) => Math.abs(s.q - 2) < 0.01);
  assert.equal(earlyFrontier.strength < laterFrontier.strength, true);
});

test('mission identity swap (optimistic -> server) keeps reveal fog identical', () => {
  const nowMs = missionStartMs(createMission()) + 15000;
  const optimistic = collectMissionSources(createMission({ id: 'optimistic-1' }), nowMs);
  const server = collectMissionSources(createMission({ id: 'server-mission-9' }), nowMs);

  assert.deepEqual(
    summarizeSources(optimistic.visionHistorySources),
    summarizeSources(server.visionHistorySources),
  );
});

test('clock before march start clamps reveal to backend facts only', () => {
  const mission = createMission();
  const beforeStart = missionStartMs(mission) - 1000;
  const coreSources = WorldMarchCore.getRouteRenderRevealSources(mission, beforeStart);

  coreSources.forEach((source) => {
    assert.equal(source.strength >= 0 && source.strength <= 1, true);
  });
  const frontierTiles = coreSources.filter((source) => source.q > 1.01);
  assert.deepEqual(frontierTiles, []);
  const backendRevealed = coreSources.find((source) => source.tileId === 'tile_1_0');
  assert.equal(backendRevealed.strength, 1);
});
