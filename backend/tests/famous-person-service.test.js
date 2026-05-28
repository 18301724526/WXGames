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
  assert.equal(FamousPersonService.APPEARANCE_VERSION, 'famous-portrait-v2.2');
  assert.ok(result.candidate.appearance.layers.outfitBack.endsWith('fp-layer-v2-art01-outfitBack-guardian-01.png'));
  assert.ok(result.candidate.appearance.layers.head.endsWith('fp-layer-v2-art01-head-base-01.png'));
  assert.ok(result.candidate.appearance.layers.hairBase.endsWith('fp-layer-v2-art01-hairBase-bound-topknot-filled-01.png'));
  assert.match(result.candidate.appearance.layers.bangs, /fp-layer-v2-art01-bangs-bound-topknot(-short|-parted|-swept)?-01\.png$/);
  assert.ok(result.candidate.appearance.layers.outfitFront.endsWith('fp-layer-v2-art01-outfitFront-guardian-01.png'));
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate.appearance.layers, 'hair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate.appearance.layers, 'backHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate.appearance.layers, 'frontHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate.appearance.layers, 'accessory'), false);
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
  assert.ok(result.candidate.appearance.layers.outfitBack.endsWith('fp-layer-v2-art01-outfitBack-guardian-01.png'));
  assert.ok(result.candidate.appearance.layers.outfitFront.endsWith('fp-layer-v2-art01-outfitFront-guardian-01.png'));
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
  assert.ok(normalized.famousPeople[0].appearance.layers.outfitBack);
  assert.ok(normalized.famousPeople[0].appearance.layers.head);
  assert.ok(normalized.famousPeople[0].appearance.layers.hairBase);
  assert.ok(normalized.famousPeople[0].appearance.layers.bangs);
  assert.ok(normalized.famousPeople[0].appearance.layers.outfitFront);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.famousPeople[0].appearance.layers, 'sideHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.famousPeople[0].appearance.layers, 'accessory'), false);
});

test('legacy portrait appearance is regenerated with the anchored complete hair set', () => {
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
        accessory: 'assets/art/famous-person/layers/fp-layer-accessory-scar-01.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);
  const layers = normalized.famousPeople[0].appearance.layers;

  assert.equal(normalized.famousPeople[0].appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.match(layers.outfitBack, /fp-layer-v2-art01-outfitBack-guardian-01\.png$/);
  assert.match(layers.head, /fp-layer-v2-art01-head-base-01\.png$/);
  assert.match(layers.hairBase, /fp-layer-v2-art01-hairBase-bound-topknot-filled-01\.png$/);
  assert.match(layers.bangs, /fp-layer-v2-art01-bangs-bound-topknot(-short|-parted|-swept)?-01\.png$/);
  assert.match(layers.outfitFront, /fp-layer-v2-art01-outfitFront-guardian-01\.png$/);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'hair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'backHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'sideHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'frontHair'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'accessory'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'bangs'), true);
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
        accessory: 'assets/art/famous-person/layers/fp-layer-accessory-scar-01.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);
  const layers = normalized.famousPeople[0].appearance.layers;

  assert.equal(normalized.famousPeople[0].appearance.version, FamousPersonService.APPEARANCE_VERSION);
  assert.match(layers.outfitFront, /fp-layer-v2-art01-outfitFront-guardian-01\.png$/);
  assert.doesNotMatch(layers.outfitFront, /fp-layer-outfit-guardian-01\.png$/);
  assert.equal(Object.prototype.hasOwnProperty.call(layers, 'accessory'), false);
});

test('current portrait normalization keeps only active five layers and drops accessories', () => {
  const state = GameStateService.createInitialGameState('fp-current-accessory');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_current_accessory',
    name: '绉︽壙',
    title: '鍨掗棬瀹堝皢',
    source: { type: 'seek', seed: 'current:accessory' },
    archetype: 'guardian',
    appearance: {
      version: FamousPersonService.APPEARANCE_VERSION,
      seed: 'current:accessory',
      palette: 'military_red',
      layers: {
        outfitBack: 'assets/art/famous-person/layers/fp-layer-v2-art01-outfitBack-guardian-01.png',
        head: 'assets/art/famous-person/layers/fp-layer-v2-art01-head-base-01.png',
        hairBase: 'assets/art/famous-person/layers/fp-layer-v2-art01-hairBase-bound-topknot-filled-01.png',
        bangs: 'assets/art/famous-person/layers/fp-layer-v2-art01-bangs-bound-topknot-swept-01.png',
        outfitFront: 'assets/art/famous-person/layers/fp-layer-v2-art01-outfitFront-guardian-01.png',
        accessory: 'assets/art/famous-person/layers/fp-layer-accessory-scar-01.png',
      },
    },
  }];

  const normalized = GameStateService.normalizeState(state);
  const layers = normalized.famousPeople[0].appearance.layers;

  assert.deepEqual(Object.keys(layers), ['outfitBack', 'head', 'hairBase', 'bangs', 'outfitFront']);
});
