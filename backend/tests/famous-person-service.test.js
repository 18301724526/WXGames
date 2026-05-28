const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateService = require('../services/GameStateService');
const FamousPersonService = require('../services/FamousPersonService');

function createRandomSequence(values) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
}

function assertV3Appearance(appearance) {
  assert.equal(appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.deepEqual(Object.keys(appearance.layers), ['outfit', 'face', 'hair']);
  assert.match(appearance.layers.outfit, /assets\/art\/famous-person\/layers\/fp-layer-v3-outfit-\d\d\.png$/);
  assert.match(appearance.layers.face, /assets\/art\/famous-person\/layers\/fp-layer-v3-face-\d\d\.png$/);
  assert.match(appearance.layers.hair, /assets\/art\/famous-person\/layers\/fp-layer-v3-hair-\d\d\.png$/);
}

test('initial game state exposes locked famous person seek state before city era', () => {
  const state = GameStateService.createInitialGameState('fp-initial');
  const client = GameStateService.getClientGameState(state);

  assert.deepEqual(client.famousPersons.people, []);
  assert.deepEqual(client.famousPersons.candidates, []);
  assert.equal(client.famousPersons.seek.available, false);
  assert.equal(client.famousPersons.seek.reason, 'ERA_LOCKED');
  assert.equal(client.famousPersons.seek.minEra, FamousPersonService.MIN_SEEK_ERA);
});

test('seek creates a generated candidate with v3 three-layer portrait and no level field', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-seek'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:00:00.000Z'),
    createRandomSequence(Array(18).fill(0)),
  );

  assert.equal(result.success, true);
  assert.equal(state.famousPersonState.candidates.length, 1);
  assert.equal(result.candidate.archetype, 'vanguard');
  assert.equal(typeof result.candidate.name, 'string');
  assert.ok(result.candidate.name.length > 0);
  assert.equal(result.candidate.skills[0].effects[0].key, 'lifesteal');
  assert.equal(result.candidate.skills[0].effects[1].key, 'combo');
  assert.equal(FamousPersonService.APPEARANCE_VERSION, 'famous-portrait-v3.0');
  assertV3Appearance(result.candidate.appearance);
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate, 'level'), false);
  assert.equal(result.candidate.source.type, 'seek');
  assert.equal(result.famousPersonState.candidateCount, 1);
});

test('generated portrait can pick across all three v3 layer pools', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-v3-pools'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:02:00.000Z'),
    createRandomSequence([
      0.2, 0, 0, 0.5, 0.4,
      0.3, 0.2, 0.1, 0.2, 0.3, 0.4,
      0, 0, 0,
      0.99, 0.49, 0,
      0,
    ]),
  );

  assert.equal(result.success, true);
  assertV3Appearance(result.candidate.appearance);
  assert.ok(result.candidate.appearance.layers.outfit.endsWith('fp-layer-v3-outfit-10.png'));
  assert.ok(result.candidate.appearance.layers.face.endsWith('fp-layer-v3-face-05.png'));
  assert.ok(result.candidate.appearance.layers.hair.endsWith('fp-layer-v3-hair-01.png'));
});

test('accept moves candidate into cloud-persisted famous people list', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-accept'));
  state.currentEra = 3;
  const seek = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:05:00.000Z'),
    createRandomSequence(Array(18).fill(0.2)),
  );

  const accepted = FamousPersonService.acceptFamousPerson(
    state,
    seek.candidate.id,
    new Date('2026-05-25T03:06:00.000Z'),
  );
  const client = FamousPersonService.getClientState(state);

  assert.equal(accepted.success, true);
  assert.equal(state.famousPeople.length, 1);
  assert.equal(state.famousPersonState.candidates.length, 0);
  assert.equal(state.famousPeople[0].id.startsWith('fp_'), true);
  assert.equal(state.famousPeople[0].source.candidateId, seek.candidate.id);
  assert.deepEqual(state.famousPeople[0].appearance, seek.candidate.appearance);
  assert.equal(state.famousPeople[0].status.assigned, 'idle');
  assert.equal(client.count, 1);
  assert.equal(client.candidateCount, 0);
});

test('candidate queue is capped and must be cleared before more seek results', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-cap'));
  state.currentEra = 3;
  for (let i = 0; i < FamousPersonService.MAX_CANDIDATES; i += 1) {
    const result = FamousPersonService.seekFamousPerson(
      state,
      { source: 'seek' },
      new Date(`2026-05-25T03:1${i}:00.000Z`),
      () => 0.1,
    );
    assert.equal(result.success, true);
  }

  const blocked = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:30:00.000Z'),
    () => 0.1,
  );

  assert.equal(blocked.success, false);
  assert.equal(blocked.error, 'CANDIDATES_FULL');
  assert.equal(state.famousPersonState.candidates.length, FamousPersonService.MAX_CANDIDATES);
});

test('normalization removes accepted duplicate candidates from legacy saves', () => {
  const state = GameStateService.createInitialGameState('fp-normalize');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_abc',
    name: 'legacy_a',
    title: 'legacy_title',
    source: { type: 'seek', candidateId: 'fpc_abc' },
    archetype: 'vanguard',
    skills: [{ id: 'skill_lifesteal_combo', effects: [{ key: 'lifesteal', value: 0.12 }, { key: 'combo', chance: 0.2 }] }],
  }];
  state.famousPersonState = {
    candidates: [{
      id: 'fpc_abc',
      name: 'legacy_a',
      title: 'legacy_title',
      source: { type: 'seek' },
      archetype: 'vanguard',
      skills: [{ id: 'skill_lifesteal_combo', effects: [{ key: 'lifesteal', value: 0.12 }, { key: 'combo', chance: 0.2 }] }],
    }],
  };

  const normalized = GameStateService.normalizeState(state);

  assert.equal(normalized.famousPeople.length, 1);
  assert.equal(normalized.famousPersonState.candidates.length, 0);
  assertV3Appearance(normalized.famousPeople[0].appearance);
});

test('legacy split portrait appearance is regenerated into v3 three-layer set', () => {
  const state = GameStateService.createInitialGameState('fp-legacy-split-hair');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_legacy_hair',
    name: 'legacy_hair',
    title: 'legacy_split',
    source: { type: 'seek', seed: 'legacy:hair' },
    archetype: 'guardian',
    appearance: {
      version: 'famous-portrait-v0.2',
      layers: {
        body: 'assets/art/famous-person/layers/fp-layer-body-skin-01.png',
        outfit: 'assets/art/famous-person/layers/fp-layer-outfit-guardian-01.png',
        frontHair: 'assets/art/famous-person/layers/fp-layer-frontHair-short-01.png',
        accessory: 'assets/art/famous-person/layers/fp-layer-accessory-scar-01.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);
  const layers = normalized.famousPeople[0].appearance.layers;

  assertV3Appearance(normalized.famousPeople[0].appearance);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'body'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'frontHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'accessory'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'bangs'), false);
});

test('current v3 portrait normalization keeps only outfit face and hair', () => {
  const state = GameStateService.createInitialGameState('fp-current-accessory');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_current_accessory',
    name: 'current_accessory',
    title: 'current_v3',
    source: { type: 'seek', seed: 'current:accessory' },
    archetype: 'guardian',
    appearance: {
      version: FamousPersonService.APPEARANCE_VERSION,
      seed: 'current:accessory',
      palette: 'military_red',
      layers: {
        outfit: 'assets/art/famous-person/layers/fp-layer-v3-outfit-01.png',
        face: 'assets/art/famous-person/layers/fp-layer-v3-face-01.png',
        hair: 'assets/art/famous-person/layers/fp-layer-v3-hair-01.png',
        accessory: 'assets/art/famous-person/layers/fp-layer-accessory-scar-01.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);

  assertV3Appearance(normalized.famousPeople[0].appearance);
  assert.deepEqual(Object.keys(normalized.famousPeople[0].appearance.layers), ['outfit', 'face', 'hair']);
});
