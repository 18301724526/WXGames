const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WorldMarchPassability = require('./worldMarchPassability');

// A terrain oracle (D) built from an explicit map; anything absent is 'unknown'
// (fog), exactly like the frontend's known-tile oracle.
function oracleFrom(map) {
  return (q, r) =>
    Object.prototype.hasOwnProperty.call(map, `${q},${r}`) ? map[`${q},${r}`] : 'unknown';
}

test('worldMarchPassability marks a fully-land route marchable with no unknowns', () => {
  const verdict = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 3, r: 0 },
    getTileTerrain: oracleFrom({ '1,0': 'plains', '2,0': 'plains', '3,0': 'plains' }),
    maxLength: 16,
  });
  assert.equal(verdict.canMarch, true);
  assert.equal(verdict.blocked, null);
  assert.equal(verdict.hasUnknownOnRoute, false);
  assert.equal(verdict.route.at(-1).tileId, 'tile_3_0');
});

test('worldMarchPassability blocks a route that crosses a KNOWN ocean tile', () => {
  const verdict = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 5, r: 0 },
    getTileTerrain: oracleFrom({ '1,0': 'plains', '2,0': 'plains', '3,0': 'ocean' }),
    maxLength: 16,
  });
  assert.equal(verdict.canMarch, false);
  assert.equal(verdict.reason, 'EXPLORE_ROUTE_BLOCKED');
  assert.equal(verdict.blocked.terrain, 'ocean');
  assert.equal(verdict.blocked.atTile.tileId, 'tile_3_0');
});

test('worldMarchPassability blocks clicking directly onto a KNOWN ocean target', () => {
  const verdict = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 1, r: 0 },
    getTileTerrain: oracleFrom({ '1,0': 'ocean' }),
    maxLength: 16,
  });
  // The first/only step is known ocean → no march (frontend hides the button).
  assert.equal(verdict.canMarch, false);
  assert.equal(verdict.blocked.atTile.tileId, 'tile_1_0');
});

test('worldMarchPassability blocks a route that crosses a KNOWN river tile', () => {
  const verdict = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 2, r: 0 },
    getTileTerrain: oracleFrom({ '1,0': 'river', '2,0': 'plains' }),
    maxLength: 16,
    axisAligned: true,
  });
  assert.equal(verdict.canMarch, false);
  assert.equal(verdict.reason, 'EXPLORE_ROUTE_BLOCKED');
  assert.equal(verdict.blocked.terrain, 'river');
  assert.equal(verdict.blocked.atTile.tileId, 'tile_1_0');
});

test('worldMarchPassability optimistically allows a fog route and flags it', () => {
  const verdict = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 3, r: 0 },
    // Nothing known → all steps are fog.
    getTileTerrain: oracleFrom({}),
    maxLength: 16,
  });
  assert.equal(verdict.canMarch, true);
  assert.equal(verdict.hasUnknownOnRoute, true);
  assert.equal(verdict.blocked, null);
});

test('worldMarchPassability stops at the first KNOWN blocker even if fog precedes it', () => {
  const verdict = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 4, r: 0 },
    // step 1 fog, step 2 land, step 3 KNOWN ocean → blocked at 3 regardless of fog.
    getTileTerrain: oracleFrom({ '2,0': 'plains', '3,0': 'ocean' }),
    maxLength: 16,
  });
  assert.equal(verdict.canMarch, false);
  assert.equal(verdict.blocked.atTile.tileId, 'tile_3_0');
  assert.equal(verdict.hasUnknownOnRoute, true);
});

test('worldMarchPassability reports geometry rejections (too far / origin)', () => {
  const tooFar = WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 17, r: 0 },
    getTileTerrain: oracleFrom({}),
    maxLength: 16,
  });
  assert.equal(tooFar.canMarch, false);
  assert.equal(tooFar.reason, 'EXPLORE_TARGET_TOO_FAR');

  const origin = WorldMarchPassability.evaluateMarch({
    origin: { q: 2, r: 2 },
    target: { q: 2, r: 2 },
    getTileTerrain: oracleFrom({}),
    maxLength: 16,
  });
  assert.equal(origin.canMarch, false);
  assert.equal(origin.reason, 'EXPLORE_TARGET_IS_ORIGIN');
});

test('worldMarchPassability emits a verdict trace for observability', () => {
  const events = [];
  WorldMarchPassability.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 2, r: 0 },
    getTileTerrain: oracleFrom({ '1,0': 'plains', '2,0': 'ocean' }),
    maxLength: 16,
    trace: (stage, payload) => events.push([stage, payload]),
    corr: 'corr-1',
  });
  const verdictEvent = events.find((e) => e[0] === 'passability:verdict');
  assert.ok(verdictEvent, 'a passability:verdict event is emitted');
  assert.equal(verdictEvent[1].corr, 'corr-1');
  assert.equal(verdictEvent[1].canMarch, false);
  assert.equal(verdictEvent[1].reason, 'EXPLORE_ROUTE_BLOCKED');
});

test('worldMarchPassability loads as a classic browser <script> global', () => {
  const corePath = path.join(__dirname, 'worldMarchCore.js');
  const passabilityPath = path.join(__dirname, 'worldMarchPassability.js');
  const context = vm.createContext({});
  // Browser load order: core first (sets the global it depends on), then this.
  vm.runInContext(fs.readFileSync(corePath, 'utf8'), context, { filename: corePath });
  vm.runInContext(fs.readFileSync(passabilityPath, 'utf8'), context, { filename: passabilityPath });
  const browser = context.WorldMarchPassability;
  assert.ok(browser && typeof browser.evaluateMarch === 'function');
  const verdict = browser.evaluateMarch({
    origin: { q: 0, r: 0 },
    target: { q: 2, r: 0 },
    getTileTerrain: oracleFrom({ '1,0': 'plains', '2,0': 'ocean' }),
    maxLength: 16,
  });
  assert.equal(verdict.canMarch, false);
  assert.equal(verdict.blocked.atTile.tileId, 'tile_2_0');
});
