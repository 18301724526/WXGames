const ServerRandomAuthorityContract = require('../random/ServerRandomAuthorityContract');

const SCOPE = 'skillGenerator';
const DEFAULT_ACTION = 'abilityKitGeneration';

function sanitizeText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function createAbilityKitSeed(input = {}) {
  return sanitizeText(input.seed, [
    sanitizeText(input.source, 'skill'),
    sanitizeText(input.archetype || input.abilityArchetype, 'vanguard'),
    sanitizeText(input.quality, 'common'),
  ].join(':'));
}

function createAbilityKitSubjectId(input = {}) {
  return [
    'abilityKit',
    sanitizeText(input.source, 'skill'),
    sanitizeText(input.archetype || input.abilityArchetype, 'vanguard'),
    sanitizeText(input.quality, 'common'),
  ].join(':');
}

function createAbilityKitRandomSource(input = {}, options = {}) {
  const seed = sanitizeText(options.seed, createAbilityKitSeed(input));
  const subjectId = sanitizeText(options.subjectId, createAbilityKitSubjectId(input));
  return ServerRandomAuthorityContract.createRandomSource({
    scope: SCOPE,
    action: sanitizeText(options.action, DEFAULT_ACTION),
    subjectId,
    seed,
  }, {
    now: options.now || input.now,
    randomSource: options.randomSource,
  });
}

function createFallbackRandomSource(options = {}) {
  return createAbilityKitRandomSource({
    source: sanitizeText(options.source, 'fallback'),
    archetype: sanitizeText(options.archetype || options.abilityArchetype, 'vanguard'),
    quality: sanitizeText(options.quality, 'common'),
    seed: sanitizeText(options.seed, 'fallback:vanguard:common'),
  }, {
    action: sanitizeText(options.action, 'unitRoll'),
    now: options.now,
    randomSource: options.randomSource,
  });
}

function getAuthorityScope(randomSource) {
  return randomSource?.authorityScope || null;
}

function createSourceMetadata(randomSource) {
  const scope = getAuthorityScope(randomSource);
  if (!scope) return null;
  return {
    schema: scope.schema,
    authority: scope.authority,
    scope: scope.scope,
    action: scope.action,
    subjectId: scope.subjectId,
    seed: scope.seed,
  };
}

module.exports = {
  DEFAULT_ACTION,
  SCOPE,
  createAbilityKitRandomSource,
  createAbilityKitSeed,
  createAbilityKitSubjectId,
  createFallbackRandomSource,
  createSourceMetadata,
  getAuthorityScope,
};
