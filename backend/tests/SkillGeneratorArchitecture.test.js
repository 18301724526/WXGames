const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SkillGeneratorService = require('../services/SkillGeneratorService');
const Constants = require('../services/skillGenerator/SkillGeneratorConstants');
const Normalizer = require('../services/skillGenerator/SkillGeneratorNormalizer');
const Factory = require('../services/skillGenerator/SkillAbilityFactory');
const KitService = require('../services/skillGenerator/SkillAbilityKitService');
const SkillGeneratorRandomAuthority = require('../services/skillGenerator/SkillGeneratorRandomAuthority');
const ServerRandomAuthorityContract = require('../services/random/ServerRandomAuthorityContract');

const serviceRoot = path.join(__dirname, '..', 'services');
const skillRoot = path.join(serviceRoot, 'skillGenerator');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('SkillGeneratorService stays a facade over focused generator modules', () => {
  const facadePath = path.join(serviceRoot, 'SkillGeneratorService.js');
  const moduleFiles = fs.readdirSync(skillRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 500, 'SkillGeneratorService should stay below 500 lines');
  assert.deepEqual(moduleFiles, [
    'SkillAbilityFactory.js',
    'SkillAbilityKitService.js',
    'SkillGeneratorConstants.js',
    'SkillGeneratorDescriptions.js',
    'SkillGeneratorNormalizer.js',
    'SkillGeneratorRandomAuthority.js',
    'SkillGeneratorShared.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(skillRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('skill generator random authority owns ability kit random source metadata', () => {
  const source = SkillGeneratorRandomAuthority.createAbilityKitRandomSource({
    source: 'unit',
    archetype: 'vanguard',
    quality: 'great',
    seed: 'unit:vanguard:great',
  }, {
    now: new Date('2026-06-09T00:00:00.000Z'),
    randomSource: () => 0.42,
  });

  assert.equal(source(), 0.42);
  assert.deepEqual(SkillGeneratorRandomAuthority.createSourceMetadata(source), {
    schema: ServerRandomAuthorityContract.SCHEMA,
    authority: ServerRandomAuthorityContract.AUTHORITY,
    domain: SkillGeneratorRandomAuthority.DOMAIN,
    action: SkillGeneratorRandomAuthority.DEFAULT_ACTION,
    subjectId: 'abilityKit:unit:vanguard:great',
    seed: 'unit:vanguard:great',
  });
  assert.equal(SkillGeneratorRandomAuthority.createAbilityKitSeed({
    source: 'seek',
    archetype: 'scout',
    quality: 'good',
  }), 'seek:scout:good');
});

test('skill generator constants and normalizer preserve public pools and migrations', () => {
  assert.equal(Constants.GENERATOR_VERSION, SkillGeneratorService.GENERATOR_VERSION);
  assert.equal(Constants.ARCHETYPE_DOMAINS.scout.domain, 'hybrid');
  assert.equal(Constants.ARCHETYPE_DOMAINS.governor.battlePolicy, 'basicAttackOnly');
  assert.equal(Constants.ACTIVE_TEMPLATES.scout.length, 2);
  assert.deepEqual(SkillGeneratorService.getDefaultEffectPool('hybrid'), Constants.SCOUT_EFFECTS);

  assert.equal(Normalizer.normalizeQuality('unknown'), 'common');
  assert.equal(Normalizer.getQualityLabel('legendary'), Constants.QUALITY_LABELS.legendary);
  assert.equal(Normalizer.rollQuality(() => 0.2), 'common');
  assert.equal(Normalizer.rollQuality(() => 0.5), 'good');
  assert.equal(Normalizer.rollQuality(() => 0.8), 'great');
  assert.equal(Normalizer.rollQuality(() => 0.99), 'legendary');
  assert.equal(Normalizer.normalizeAbilityArchetype('missing'), 'vanguard');

  assert.deepEqual(Normalizer.normalizeEffect({ key: 'combo', chance: 0.5 }), {
    key: 'secondHit',
    multiplier: 0.36,
    migratedFrom: 'combo',
  });
  assert.equal(Normalizer.normalizeEffect({ key: 'counter' }), null);
});

test('skill ability factory owns template creation and budget checks', () => {
  const active = Factory.createActiveSkill('vanguard', 'common', () => 0.2);
  assert.equal(active.slot, 'activeSkill');
  assert.equal(active.kind, 'active');
  assert.equal(active.budget.limit, Constants.QUALITY_BUDGETS.common.active);
  assert.equal(active.budget.cost <= active.budget.limit, true);
  assert.match(active.description, /战法|倒戈|追击|破甲/);

  const civil = Factory.createCivilAbility('governor', 'civilPrimary', 'great', () => 0.2);
  assert.equal(civil.kind, 'civil');
  assert.equal(civil.trigger, 'passiveStored');
  assert.equal(civil.implementationStatus, 'storedOnly');

  const checks = Factory.createBudgetChecks([active, civil]);
  assert.equal(Factory.summarizeBudgetStatus(checks), 'withinLimit');
});

test('SkillGeneratorService facade preserves ability kit API for battle, civil, and scout domains', () => {
  const expectedApi = [
    'CIVIL_EFFECTS',
    'FIRST_BATCH_BATTLE_EFFECTS',
    'GENERATOR_VERSION',
    'LEGACY_EFFECT_MIGRATIONS',
    'QUALITY_BUDGETS',
    'QUALITY_LABELS',
    'SCOUT_EFFECTS',
    'createAbilityKit',
    'getActiveBattleSkill',
    'getDefaultEffectPool',
    'getQualityLabel',
    'normalizeAbilityArchetype',
    'normalizeAbilityKit',
    'normalizeEffect',
    'normalizeQuality',
    'rollQuality',
  ];
  assert.deepEqual(Object.keys(SkillGeneratorService).sort(), expectedApi.sort());

  const battleKit = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'vanguard',
    quality: 'great',
    source: 'test',
    seed: 'battle-kit',
  }, () => 0.2);
  assert.equal(battleKit.domain, 'battle');
  assert.equal(battleKit.randomAuthority, undefined);
  assert.equal(battleKit.battlePolicy, 'useBattleSkill');
  assert.deepEqual(battleKit.abilities.map((ability) => ability.slot), ['activeSkill', 'passiveTrait']);
  assert.equal(SkillGeneratorService.getActiveBattleSkill(battleKit).slot, 'activeSkill');
  assert.equal(battleKit.budgetStatus, 'withinLimit');

  const civilKit = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'governor',
    quality: 'great',
    source: 'test',
    seed: 'civil-kit',
  }, () => 0.2);
  assert.equal(civilKit.domain, 'civil');
  assert.equal(civilKit.battlePolicy, 'basicAttackOnly');
  assert.deepEqual(civilKit.abilities.map((ability) => ability.slot), ['civilPrimary', 'civilSecondary']);
  assert.equal(SkillGeneratorService.getActiveBattleSkill(civilKit), null);

  const scoutKit = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'scout',
    quality: 'great',
    source: 'tutorial',
    seed: 'scout-kit',
  }, () => 0.2);
  assert.equal(scoutKit.domain, 'hybrid');
  assert.deepEqual(scoutKit.abilities.map((ability) => ability.slot), ['activeSkill', 'scoutTrait']);
});

test('skill ability kit generation consumes server random authority by default', () => {
  const kit = SkillGeneratorService.createAbilityKit({
    abilityArchetype: 'strategist',
    quality: 'great',
    source: 'authority-test',
    seed: 'authority-test:strategist:great',
  });

  assert.deepEqual(kit.randomAuthority, {
    schema: ServerRandomAuthorityContract.SCHEMA,
    authority: ServerRandomAuthorityContract.AUTHORITY,
    domain: SkillGeneratorRandomAuthority.DOMAIN,
    action: SkillGeneratorRandomAuthority.DEFAULT_ACTION,
    subjectId: 'abilityKit:authority-test:strategist:great',
    seed: 'authority-test:strategist:great',
  });
  assert.equal(kit.generatorInput.seed, 'authority-test:strategist:great');
  assert.equal(kit.abilities.length, 2);
  assert.equal(kit.budgetStatus, 'withinLimit');
});

test('skill ability kit service completes legacy and partial stored kits', () => {
  const legacy = KitService.normalizeAbilityKit({}, {
    abilityArchetype: 'vanguard',
    quality: 'good',
    source: 'legacy',
    seed: 'legacy-kit',
    skills: [{
      id: 'legacy_active',
      name: 'Legacy Active',
      type: 'battle',
      effects: [{ key: 'combo', chance: 0.22 }],
    }],
  });
  assert.equal(legacy.abilities.length, 2);
  assert.equal(legacy.abilities[0].slot, 'activeSkill');
  assert.equal(legacy.abilities[0].effects[0].key, 'secondHit');
  assert.equal(legacy.abilities[1].slot, 'passiveTrait');

  const partialCivil = KitService.normalizeAbilityKit({
    archetype: 'governor',
    quality: 'great',
    abilities: [{
      id: 'stored_primary',
      name: 'Stored Primary',
      slot: 'civilPrimary',
      kind: 'civil',
      effects: [{ key: 'resourceOutputPct', resource: 'food', value: 0.2 }],
    }],
  }, { seed: 'partial-civil' });
  assert.deepEqual(partialCivil.abilities.map((ability) => ability.slot), ['civilPrimary', 'civilSecondary']);
  assert.equal(partialCivil.abilities[0].id, 'stored_primary');
  assert.equal(partialCivil.budgetStatus, 'withinLimit');
});
