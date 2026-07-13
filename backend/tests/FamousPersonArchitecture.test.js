const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FamousPersonService = require('../services/FamousPersonService');
const Constants = require('../services/famousPerson/FamousPersonConstants');
const Shared = require('../services/famousPerson/FamousPersonShared');
const Progression = require('../services/famousPerson/FamousPersonProgression');
const Generator = require('../services/famousPerson/FamousPersonGenerator');
const SkillNormalizer = require('../services/famousPerson/FamousPersonSkillNormalizer');
const FamousPersonRandomAuthority = require('../services/famousPerson/FamousPersonRandomAuthority');
const ServerRandomAuthorityContract = require('../services/random/ServerRandomAuthorityContract');

const serviceRoot = path.join(__dirname, '..', 'services');
const famousRoot = path.join(serviceRoot, 'famousPerson');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('FamousPersonService delegates static and progression responsibilities to famous person modules', () => {
  const facadePath = path.join(serviceRoot, 'FamousPersonService.js');
  const moduleFiles = fs.readdirSync(famousRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 500, 'FamousPersonService should stay below 500 lines');
  assert.deepEqual(moduleFiles, [
    'FamousPersonConstants.js',
    'FamousPersonGenerator.js',
    'FamousPersonProgression.js',
    'FamousPersonRandomAuthority.js',
    'FamousPersonShared.js',
    'FamousPersonSkillNormalizer.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(famousRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('famous person constants and shared helpers preserve deterministic generation inputs', () => {
  assert.equal(Constants.MIN_SEEK_ERA, 3);
  assert.equal(Constants.MAX_CANDIDATES, 3);
  assert.equal(Constants.ARCHETYPES.some((item) => item.id === 'scout' && item.abilityArchetype === 'scout'), true);
  assert.equal(Constants.EFFECTS.secondHit.label, '二段伤害');

  const left = Shared.createSeedRandom('same-seed');
  const right = Shared.createSeedRandom('same-seed');
  assert.deepEqual([left(), left(), left()], [right(), right(), right()]);
  assert.equal(Shared.pick(['a', 'b', 'c'], () => 0.99), 'c');
  assert.equal(Shared.toInteger('4.9'), 4);
});

test('famous person progression module owns level, attribute, and auto-growth contracts', () => {
  assert.equal(Progression.getLevelUpExperience(1), FamousPersonService.getLevelUpExperience(1));
  assert.deepEqual(
    Progression.calculateAutoAttributeGrowth('great', 'scout'),
    FamousPersonService.calculateAutoAttributeGrowth('great', 'scout'),
  );
  assert.deepEqual(Progression.calculateAutoAttributeGrowth('great', 'scout'), {
    command: 1,
    force: 1,
    intelligence: 2,
    charisma: 1,
    speed: 3,
  });

  const person = {
    id: 'fp-growth',
    quality: 'great',
    abilityArchetype: 'scout',
    level: 10,
    attributes: { command: 40, force: 40, intelligence: 40, politics: 40, charisma: 40, speed: 40 },
  };
  const applied = Progression.applyPendingAutoAttributeGrowth(person);
  assert.equal(applied.total, 8);
  assert.deepEqual(applied.milestones, [10]);
  assert.equal(person.attributes.speed, 43);
  assert.equal(person.autoGrowthMilestones[0], 10);
});

test('famous person generator preserves candidate and starter reward contracts', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'famous-arch',
    activeCityId: 'capital',
    currentEra: 3,
  };
  const candidate = FamousPersonService.createFamousPersonCandidate(gameState, { source: 'seek' }, now, () => 0.42);
  assert.equal(candidate.id.startsWith('fpc_'), true);
  assert.equal(candidate.source.type, 'seek');
  assert.equal(candidate.joinedAt, null);
  assert.equal(candidate.appearance.version, Constants.APPEARANCE_VERSION);

  const starterScout = FamousPersonService.createStarterScoutFamousPerson(gameState, now);
  assert.equal(starterScout.quality, 'great'); // always purple (英杰)
  // Starter gift is a RANDOM combat (military) archetype so the player can always deploy it and
  // open the game — never a civil-only officer. Assert the guarantee (military role), not a
  // specific archetype (the archetype is randomized per game).
  assert.ok(starterScout.roles.includes('military'), 'starter reward must be a combat general');
  assert.equal(starterScout.source.type, 'starter-reward');

  assert.equal(Generator.makeSkillName([{ key: 'lifesteal' }, { key: 'secondHit' }]), '血刃连袭');
  assert.equal(Generator.getArchetypePool('seek').some((item) => item.id === 'scout'), true);
  assert.equal(typeof SkillNormalizer.normalizeSkill, 'function');
});

test('famous person normalization backfills social fields through PersonSocialFields', () => {
  const [person] = FamousPersonService.normalizeFamousPeople([{
    id: 'fp-social',
    name: 'Social',
    personality: { nature: 'stale', axes: { boldness: 0.85, sociability: 0.1, integrity: 0.2 } },
    gender: 'female',
    orientation: 'same',
    relationships: [{ toPersonId: 'fp-friend', affinity: 50, meetCount: 5 }],
    factionId: 'ai_wei',
  }]);

  assert.equal(person.personality.nature, 'valiant');
  assert.equal(person.gender, 'female');
  assert.equal(person.orientation, 'same');
  assert.equal(person.relationships[0].kind, 'friend');
  assert.equal(person.factionId, 'ai_wei');
});

test('famous person candidate generation consumes server random authority by default', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'famous-authority',
    activeCityId: 'capital',
    currentEra: 3,
  };

  const candidate = FamousPersonService.createFamousPersonCandidate(gameState, { source: 'seek' }, now);
  const injected = FamousPersonService.createFamousPersonCandidate(gameState, { source: 'seek' }, now, () => 0.42);

  assert.deepEqual(candidate.source.randomAuthority, {
    schema: ServerRandomAuthorityContract.SCHEMA,
    authority: ServerRandomAuthorityContract.AUTHORITY,
    scope: FamousPersonRandomAuthority.SCOPE,
    action: FamousPersonRandomAuthority.DEFAULT_ACTION,
    subjectId: 'candidate:famous-authority:seek:capital',
    seed: 'famous-authority:seek:1780704000000:capital',
  });
  assert.equal(injected.source.randomAuthority, undefined);
});

test('FamousPersonService facade preserves seek, accept, and starter reward API', () => {
  const expectedApi = [
    'APPEARANCE_VERSION',
    'ARCHETYPES',
    'ATTRIBUTE_KEYS',
    'ATTRIBUTE_POINT_MILESTONE',
    'ATTRIBUTE_POINTS_PER_MILESTONE',
    'AUTO_GROWTH_WEIGHTS',
    'BASE_LEVEL',
    'EFFECTS',
    'ENABLED_SOURCE_TYPES',
    'GENERATOR_VERSION',
    'MAX_CANDIDATES',
    'MIN_SEEK_ERA',
    'QUALITY_AUTO_GROWTH_POINTS',
    'acceptFamousPerson',
    'applyAutoAttributeGrowth',
    'assignAttributePoint',
    'calculateAutoAttributeGrowth',
    'createFamousPersonCandidate',
    'createInitialFamousPersonState',
    'createStarterScoutFamousPerson',
    'dismissFamousPersonCandidate',
    'ensureFamousPersonState',
    'getClientState',
    'getClientStateFromNormalized',
    'getLevelUpExperience',
    'getSeekAvailabilityFromState',
    'grantBattleExperience',
    'grantStarterScoutFamousPerson',
    'makeSkillName',
    'normalizeFamousPeople',
    'normalizeFamousPersonState',
    'normalizeProgression',
    'seekFamousPerson',
  ];

  assert.deepEqual(Object.keys(FamousPersonService).sort(), expectedApi.sort());

  const gameState = {
    playerId: 'famous-facade',
    activeCityId: 'capital',
    currentEra: 3,
    famousPeople: [],
    famousPersonState: FamousPersonService.createInitialFamousPersonState(),
  };
  const sought = FamousPersonService.seekFamousPerson(gameState, { source: 'seek' }, new Date('2026-06-06T00:01:00.000Z'), () => 0.25);
  assert.equal(sought.success, true);
  assert.equal(gameState.famousPersonState.candidates.length, 1);

  const accepted = FamousPersonService.acceptFamousPerson(gameState, sought.candidate.id, new Date('2026-06-06T00:02:00.000Z'));
  assert.equal(accepted.success, true);
  assert.equal(gameState.famousPeople.length, 1);
  assert.equal(gameState.famousPersonState.candidates.length, 0);

  const grant = FamousPersonService.grantStarterScoutFamousPerson(gameState, new Date('2026-06-06T00:03:00.000Z'));
  assert.ok(grant.person.roles.includes('military'), 'granted starter must be a combat general');
  assert.equal(grant.person.source.type, 'starter-reward');
});

test('starter reward general: combat-only pool + stable-marker idempotency (decoupled from archetype)', () => {
  const Generator = require('../services/famousPerson/FamousPersonGenerator');

  // The gift pool is combat-only (military role) — never a civil officer the player cannot deploy,
  // so a new player can always open the game. Derived from archetype roles (single source).
  const pool = Generator.getStarterArchetypePool();
  assert.ok(pool.length >= 2);
  assert.ok(pool.every((archetype) => archetype.roles.includes('military')));
  assert.ok(!pool.some((archetype) => ['warden', 'scholar', 'artisan', 'envoy'].includes(archetype.id)));

  // Idempotency keys off the stable starter-reward marker, NOT the (randomized) archetype: a second
  // grant at a DIFFERENT time returns the SAME person — proving future changes to WHAT the starter
  // is never touch how it is found.
  const gameState = {
    playerId: 'starter-decouple',
    activeCityId: 'capital',
    famousPeople: [],
    famousPersonState: FamousPersonService.createInitialFamousPersonState(),
  };
  const first = FamousPersonService.grantStarterScoutFamousPerson(gameState, new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(first.created, true);
  assert.equal(first.person.quality, 'great');
  assert.ok(first.person.roles.includes('military'));
  assert.ok(Generator.isStarterRewardFamousPerson(first.person));

  const second = FamousPersonService.grantStarterScoutFamousPerson(gameState, new Date('2026-06-06T09:00:00.000Z'));
  assert.equal(second.created, false);
  assert.equal(gameState.famousPeople.length, 1);
  assert.equal(second.person.id, first.person.id);
});
