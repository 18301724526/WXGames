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

test('initial game state exposes locked famous person seek state before city era', () => {
  const state = GameStateService.createInitialGameState('fp-initial');
  const client = GameStateService.getClientGameState(state);

  assert.deepEqual(client.famousPersons.people, []);
  assert.deepEqual(client.famousPersons.candidates, []);
  assert.equal(client.famousPersons.seek.available, false);
  assert.equal(client.famousPersons.seek.reason, 'ERA_LOCKED');
  assert.equal(client.famousPersons.seek.minEra, FamousPersonService.MIN_SEEK_ERA);
});

test('seek creates a generated candidate with matching skill name and no level field', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-seek'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:00:00.000Z'),
    createRandomSequence([0, 0, 0, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 0.2, 0.3]),
  );

  assert.equal(result.success, true);
  assert.equal(state.famousPersonState.candidates.length, 1);
  assert.equal(result.candidate.archetype, 'vanguard');
  assert.equal(result.candidate.name, '陆骁');
  assert.equal(result.candidate.skills[0].name, '血刃连袭');
  assert.equal(result.candidate.appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.ok(result.candidate.appearance.layers.body.endsWith('fp-layer-body-skin-01.png'));
  assert.equal(FamousPersonService.APPEARANCE_VERSION, 'famous-portrait-v0.9');
  assert.ok(result.candidate.appearance.layers.outfit.endsWith('fp-layer-outfit-vanguard-front-candidate-02.png'));
  assert.ok(result.candidate.appearance.layers.backHair.endsWith('fp-layer-backHair-short-02.png'));
  assert.ok(result.candidate.appearance.layers.sideHair.endsWith('fp-layer-sideHair-short-01.png'));
  assert.ok(result.candidate.appearance.layers.frontHair.endsWith('fp-layer-frontHair-short-02.png'));
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate, 'level'), false);
  assert.equal(result.candidate.source.type, 'seek');
  assert.equal(result.famousPersonState.candidateCount, 1);
});

test('guardian archetype uses its own portrait outfit', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-guardian-portrait'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:02:00.000Z'),
    createRandomSequence([0.2, 0, 0, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 0.2, 0.3]),
  );

  assert.equal(result.success, true);
  assert.equal(result.candidate.archetype, 'guardian');
  assert.ok(result.candidate.appearance.layers.outfit.endsWith('fp-layer-outfit-guardian-front-candidate-01.png'));
});

test('accept moves candidate into cloud-persisted famous people list', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-accept'));
  state.currentEra = 3;
  const seek = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:05:00.000Z'),
    createRandomSequence([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]),
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
    name: '陆骁',
    title: '山道突骑',
    source: { type: 'seek', candidateId: 'fpc_abc' },
    archetype: 'vanguard',
    skills: [{ id: 'skill_lifesteal_combo', effects: [{ key: 'lifesteal', value: 0.12 }, { key: 'combo', chance: 0.2 }] }],
  }];
  state.famousPersonState = {
    candidates: [{
      id: 'fpc_abc',
      name: '陆骁',
      title: '山道突骑',
      source: { type: 'seek' },
      archetype: 'vanguard',
      skills: [{ id: 'skill_lifesteal_combo', effects: [{ key: 'lifesteal', value: 0.12 }, { key: 'combo', chance: 0.2 }] }],
    }],
  };

  const normalized = GameStateService.normalizeState(state);

  assert.equal(normalized.famousPeople.length, 1);
  assert.equal(normalized.famousPersonState.candidates.length, 0);
  assert.equal(normalized.famousPeople[0].appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.ok(normalized.famousPeople[0].appearance.layers.backHair);
  assert.ok(normalized.famousPeople[0].appearance.layers.sideHair);
  assert.ok(normalized.famousPeople[0].appearance.layers.body);
  assert.ok(normalized.famousPeople[0].appearance.layers.outfit);
  assert.ok(normalized.famousPeople[0].appearance.layers.frontHair);
});

test('legacy portrait appearance is regenerated with the validated short hair set', () => {
  const state = GameStateService.createInitialGameState('fp-legacy-split-hair');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_legacy_hair',
    name: '韩晓',
    title: '垒门守将',
    source: { type: 'seek', seed: 'legacy:hair' },
    archetype: 'guardian',
    appearance: {
      version: 'famous-portrait-v0.2',
      layers: {
        body: 'assets/art/famous-person/layers/fp-layer-body-skin-01.png',
        outfit: 'assets/art/famous-person/layers/fp-layer-outfit-guardian-01.png',
        frontHair: 'assets/art/famous-person/layers/fp-layer-frontHair-short-01.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);
  const layers = normalized.famousPeople[0].appearance.layers;

  assert.equal(normalized.famousPeople[0].appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.match(layers.outfit, /fp-layer-outfit-guardian-front-candidate-01\.png$/);
  assert.match(layers.backHair, /fp-layer-backHair-short-02\.png$/);
  assert.match(layers.sideHair, /fp-layer-sideHair-short-01\.png$/);
  assert.match(layers.frontHair, /fp-layer-frontHair-short-02\.png$/);
  assert.doesNotMatch(layers.backHair, /backHair-tied/);
  assert.doesNotMatch(layers.sideHair, /sideHair-tied/);
  assert.doesNotMatch(layers.frontHair, /frontHair-tied/);
});

test('unversioned portrait appearance is regenerated away from deleted outfit assets', () => {
  const state = GameStateService.createInitialGameState('fp-unversioned-outfit');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_unversioned_outfit',
    name: '秦承',
    title: '垒门守将',
    source: { type: 'seek', seed: 'legacy:unversioned-outfit' },
    archetype: 'guardian',
    appearance: {
      layers: {
        body: 'assets/art/famous-person/layers/fp-layer-body-skin-01.png',
        outfit: 'assets/art/famous-person/layers/fp-layer-outfit-guardian-01.png',
        frontHair: 'assets/art/famous-person/layers/fp-layer-frontHair-short-02.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);
  const layers = normalized.famousPeople[0].appearance.layers;

  assert.equal(normalized.famousPeople[0].appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.match(layers.outfit, /fp-layer-outfit-guardian-front-candidate-01\.png$/);
  assert.doesNotMatch(layers.outfit, /fp-layer-outfit-guardian-01\.png$/);
});
