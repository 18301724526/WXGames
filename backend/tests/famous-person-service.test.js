const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateService = require('../services/GameStateService');
const FamousPersonService = require('../services/FamousPersonService');
const SkillGeneratorService = require('../services/SkillGeneratorService');

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
  assert.equal(result.candidate.quality, 'common');
  assert.equal(result.candidate.abilityKit.generatorVersion, SkillGeneratorService.GENERATOR_VERSION);
  assert.equal(result.candidate.abilityKit.domain, 'battle');
  assert.equal(result.candidate.abilityKit.battlePolicy, 'useBattleSkill');
  assert.equal(result.candidate.abilityKit.source, 'seek');
  assert.equal(result.candidate.abilityKit.seed, result.candidate.source.seed);
  assert.deepEqual(result.candidate.abilityKit.generatorInput, {
    quality: 'common',
    archetype: 'vanguard',
    source: 'seek',
    seed: result.candidate.source.seed,
    availableEffectPool: SkillGeneratorService.FIRST_BATCH_BATTLE_EFFECTS,
    generatorVersion: SkillGeneratorService.GENERATOR_VERSION,
  });
  assert.equal(result.candidate.abilityKit.budgetStatus, 'withinLimit');
  assert.equal(result.candidate.abilityKit.budgetChecks.every((check) => check.withinLimit), true);
  assert.equal(result.candidate.abilityKit.abilities[0].slot, 'activeSkill');
  assert.equal(typeof result.candidate.abilityKit.abilities[0].description, 'string');
  assert.match(result.candidate.abilityKit.abilities[0].description, /发动战法|倒戈|追击/);
  assert.doesNotMatch(result.candidate.abilityKit.abilities[0].description, /自身行动|冷却\s*\d+\s*次|直接伤害|属性修正/);
  assert.equal(result.candidate.skills[0].effects[0].key, 'directDamage');
  assert.ok(SkillGeneratorService.FIRST_BATCH_BATTLE_EFFECTS.includes(result.candidate.skills[0].effects[0].key));
  assert.equal(FamousPersonService.APPEARANCE_VERSION, 'famous-portrait-v3.0');
  assertV3Appearance(result.candidate.appearance);
  assert.equal(Object.prototype.hasOwnProperty.call(result.candidate, 'level'), false);
  assert.equal(result.candidate.source.type, 'seek');
  assert.equal(result.famousPersonState.candidateCount, 1);
});

test('civil famous person receives stored civil abilities and no battle skill fallback', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-civil-kit'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:00:30.000Z'),
    createRandomSequence([
      0.4,
      0.2,
      0, 0, 0, 0,
      0.2,
      0.2, 0.2,
      0, 0, 0,
    ]),
  );

  assert.equal(result.success, true);
  assert.equal(result.candidate.archetype, 'warden');
  assert.equal(result.candidate.abilityKit.domain, 'civil');
  assert.equal(result.candidate.abilityKit.battlePolicy, 'basicAttackOnly');
  assert.deepEqual(result.candidate.abilityKit.availableEffectPool, SkillGeneratorService.CIVIL_EFFECTS);
  assert.deepEqual(result.candidate.abilityKit.abilities.map((ability) => ability.slot), ['civilPrimary', 'civilSecondary']);
  assert.equal(result.candidate.abilityKit.abilities.every((ability) => ability.kind === 'civil'), true);
  assert.equal(result.candidate.abilityKit.abilities.every((ability) => ability.implementationStatus === 'storedOnly'), true);
  assert.equal(result.candidate.abilityKit.abilities.every((ability) => /提高|降低/.test(ability.description)), true);
  assert.deepEqual(result.candidate.skills, []);
});

test('scout famous person receives a light active skill and scout trait', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-scout-kit'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'seek' },
    new Date('2026-05-25T03:00:45.000Z'),
    createRandomSequence([
      0.92,
      0.1,
      0, 0, 0, 0,
      0.2,
      0.2, 0.2,
      0, 0, 0,
    ]),
  );

  assert.equal(result.success, true);
  assert.equal(result.candidate.archetype, 'scout');
  assert.equal(result.candidate.abilityKit.domain, 'hybrid');
  assert.equal(result.candidate.abilityKit.battlePolicy, 'useBattleSkill');
  assert.deepEqual(result.candidate.abilityKit.availableEffectPool, SkillGeneratorService.SCOUT_EFFECTS);
  assert.deepEqual(result.candidate.abilityKit.abilities.map((ability) => ability.slot), ['activeSkill', 'scoutTrait']);
  assert.equal(result.candidate.skills.length, 1);
  assert.equal(result.candidate.skills[0].castPolicy, 'conditional');
  assert.equal(result.candidate.abilityKit.abilities[1].implementationStatus, 'storedOnly');
});

test('skill generator can build deterministic ability kits from source seed and filtered effect pool', () => {
  const first = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'vanguard',
    quality: 'great',
    source: 'seek',
    seed: 'same-seed',
    availableEffectPool: ['directDamage', 'secondHit', 'burn'],
  });
  const second = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'vanguard',
    quality: 'great',
    source: 'seek',
    seed: 'same-seed',
    availableEffectPool: ['directDamage', 'secondHit', 'burn'],
  });
  const different = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'vanguard',
    quality: 'great',
    source: 'seek',
    seed: 'seed-a',
  });

  assert.deepEqual(first.abilities.map((ability) => ability.id), second.abilities.map((ability) => ability.id));
  assert.notDeepEqual(first.abilities.map((ability) => ability.id), different.abilities.map((ability) => ability.id));
  assert.deepEqual(first.availableEffectPool, ['directDamage', 'secondHit']);
  assert.deepEqual(first.generatorInput.availableEffectPool, ['directDamage', 'secondHit']);
  assert.equal(first.abilities[0].id, 'skill_vanguard_double_cleave');
  assert.deepEqual(first.abilities[0].effects.map((effect) => effect.key), ['directDamage', 'secondHit']);
  assert.equal(first.generatorInput.generatorVersion, SkillGeneratorService.GENERATOR_VERSION);
  assert.equal(first.budgetStatus, 'withinLimit');
  assert.equal(first.budgetChecks.length, first.abilities.length);
});

test('legacy famous person skill effects migrate to first batch deterministic atoms', () => {
  const state = GameStateService.createInitialGameState('fp-legacy-skill-migration');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_legacy_combo',
    name: 'legacy_combo',
    title: 'legacy_skill',
    source: { type: 'seek', seed: 'legacy:skill' },
    archetype: 'vanguard',
    skills: [{
      id: 'skill_legacy_combo_ambush',
      name: '伏击连袭',
      type: 'battle',
      effects: [
        { key: 'combo', chance: 0.24 },
        { key: 'ambush', chance: 0.2 },
        { key: 'morale', value: 0.12 },
        { key: 'counter', chance: 0.2 },
      ],
    }],
  }];

  const normalized = GameStateService.normalizeState(state);
  const person = normalized.famousPeople[0];
  const skill = person.skills[0];
  const ability = person.abilityKit.abilities[0];

  assert.deepEqual(skill.effects.map((effect) => effect.key), ['secondHit', 'firstStrike', 'attributeBonus']);
  assert.deepEqual(skill.effects.map((effect) => effect.migratedFrom), ['combo', 'ambush', 'morale']);
  assert.equal(skill.effects.some((effect) => effect.key === 'counter'), false);
  assert.deepEqual(ability.effects.map((effect) => effect.key), ['secondHit', 'firstStrike', 'attributeBonus']);
  assert.match(ability.description, /追击/);
  assert.match(ability.description, /先机打击/);
  assert.match(ability.description, /统帅提高/);
  assert.doesNotMatch(ability.description, /二段伤害|属性修正/);
  assert.deepEqual(person.abilityKit.abilities.map((item) => item.slot), ['activeSkill', 'passiveTrait']);
  assert.equal(person.abilityKit.generatorVersion, SkillGeneratorService.GENERATOR_VERSION);
  assert.equal(person.abilityKit.generatorInput.seed, 'legacy:skill');
  assert.equal(person.abilityKit.budgetChecks.length, 2);
  assert.equal(person.abilityKit.budgetStatus, 'withinLimit');
  assert.equal(person.abilityKit.abilities[1].kind, 'passive');
  assert.equal(person.abilityKit.abilities[1].trigger, 'preBattle');
  assert.equal(typeof person.abilityKit.abilities[1].description, 'string');
  assert.equal(person.abilityKit.abilities[1].generatorVersion, SkillGeneratorService.GENERATOR_VERSION);
});

test('legacy civil famous people upgrade to stored civil abilities without battle skills', () => {
  const state = GameStateService.createInitialGameState('fp-legacy-civil-upgrade');
  state.currentEra = 3;
  state.famousPeople = [{
    id: 'fp_legacy_envoy',
    name: 'legacy_envoy',
    title: 'legacy_civil',
    source: { type: 'seek', seed: 'legacy:civil' },
    archetype: 'envoy',
    abilityArchetype: 'charmer',
    roles: ['craft'],
    attributes: { command: 34, force: 22, intelligence: 58, politics: 66, craft: 84, charisma: 84, speed: 42 },
    skills: [{
      id: 'skill_legacy_morale_heal',
      name: '振军疗伤',
      type: 'battle',
      effects: [
        { key: 'morale', value: 0.12 },
        { key: 'heal', value: 0.1 },
      ],
    }],
  }];

  const normalized = GameStateService.normalizeState(state);
  const person = normalized.famousPeople[0];

  assert.equal(person.abilityKit.domain, 'civil');
  assert.equal(person.abilityKit.battlePolicy, 'basicAttackOnly');
  assert.deepEqual(person.roles, ['governance']);
  assert.equal(Object.prototype.hasOwnProperty.call(person.attributes, 'craft'), false);
  assert.deepEqual(person.abilityKit.abilities.map((ability) => ability.slot), ['civilPrimary', 'civilSecondary']);
  assert.equal(person.abilityKit.abilities.every((ability) => ability.kind === 'civil'), true);
  assert.equal(person.abilityKit.abilities.every((ability) => ability.implementationStatus === 'storedOnly'), true);
  assert.equal(person.abilityKit.abilities.every((ability) => /提高|降低/.test(ability.description)), true);
  assert.deepEqual(person.skills, []);
  assert.equal(person.abilityKit.generatorInput.seed, 'legacy:civil');
  assert.equal(person.abilityKit.budgetChecks.length, 2);
});

test('legacy scout candidates upgrade to active skill plus scout trait', () => {
  const state = GameStateService.createInitialGameState('fp-legacy-scout-candidate-upgrade');
  state.currentEra = 3;
  state.famousPersonState = {
    candidates: [{
      id: 'fpc_legacy_scout',
      name: 'legacy_scout',
      title: 'legacy_candidate',
      source: { type: 'seek', seed: 'legacy:scout' },
      archetype: 'scout',
      abilityKit: {
        archetype: 'scout',
        quality: 'good',
        source: 'seek',
        seed: 'legacy:scout:kit',
        abilities: [{
          id: 'skill_legacy_scout_ambush',
          name: '伏击连袭',
          type: 'battle',
          kind: 'active',
          effects: [
            { key: 'ambush', chance: 0.2 },
            { key: 'combo', chance: 0.24 },
          ],
        }],
      },
    }],
  };

  const normalized = GameStateService.normalizeState(state);
  const candidate = normalized.famousPersonState.candidates[0];
  const active = candidate.abilityKit.abilities[0];
  const trait = candidate.abilityKit.abilities[1];

  assert.equal(candidate.abilityKit.domain, 'hybrid');
  assert.deepEqual(candidate.abilityKit.abilities.map((ability) => ability.slot), ['activeSkill', 'scoutTrait']);
  assert.deepEqual(active.effects.map((effect) => effect.key), ['firstStrike', 'secondHit']);
  assert.deepEqual(active.effects.map((effect) => effect.migratedFrom), ['ambush', 'combo']);
  assert.equal(active.castPolicy, 'conditional');
  assert.deepEqual(active.castConditions.map((condition) => condition.type), ['cooldownReady', 'targetAlive']);
  assert.equal(trait.implementationStatus, 'storedOnly');
  assert.equal(trait.generatorVersion, SkillGeneratorService.GENERATOR_VERSION);
  assert.equal(candidate.skills.length, 1);
  assert.equal(candidate.abilityKit.generatorInput.seed, 'legacy:scout:kit');
  assert.equal(candidate.abilityKit.budgetChecks.length, 2);
});

test('famous person generation currently exposes only seek source', () => {
  const state = GameStateService.normalizeState(GameStateService.createInitialGameState('fp-source-lock'));
  state.currentEra = 3;

  const result = FamousPersonService.seekFamousPerson(
    state,
    { source: 'postWar' },
    new Date('2026-05-25T03:01:00.000Z'),
    createRandomSequence(Array(18).fill(0.1)),
  );
  const client = FamousPersonService.getClientState(state);

  assert.equal(result.success, true);
  assert.equal(result.candidate.source.type, 'seek');
  assert.deepEqual(client.seek.sources, [{ id: 'seek', label: '寻访' }]);
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
      0, 0, 0.99,
      0.49, 0, 0,
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
