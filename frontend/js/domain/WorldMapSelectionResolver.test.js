const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileCoord');
const Resolver = require('./WorldMapSelectionResolver');

test('WorldMapSelectionResolver returns a picker action for overlapping site and actor candidates', () => {
  const action = Resolver.resolveCandidates([
    {
      x: 40,
      y: 40,
      width: 80,
      height: 60,
      kind: 'site',
      label: 'Capital',
      action: { type: 'openWorldSite', siteId: 'capital', tileId: 'tile_0_0' },
    },
    {
      x: 50,
      y: 50,
      width: 42,
      height: 42,
      kind: 'actor',
      label: 'Scout A',
      action: { type: 'selectWorldActor', actorId: 'actor-1', missionId: 'march-1', tileId: 'tile_0_0' },
    },
  ], { point: { x: 60, y: 60 } });

  assert.equal(action.type, 'openWorldTargetPicker');
  assert.equal(action.tileId, 'tile_0_0');
  assert.equal(action.candidates.length, 2);
  assert.equal(action.candidates.some((candidate) => candidate.action.type === 'openWorldSite'), true);
  assert.equal(action.candidates.some((candidate) => candidate.action.type === 'selectWorldActor'), true);
});

test('WorldMapSelectionResolver directly returns the only candidate action', () => {
  const action = Resolver.resolveCandidates([
    { kind: 'actor', action: { type: 'selectWorldActor', actorId: 'actor-1' } },
  ]);

  assert.deepEqual(action, { type: 'selectWorldActor', actorId: 'actor-1' });
});
