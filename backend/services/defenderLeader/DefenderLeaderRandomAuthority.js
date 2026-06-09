const ServerRandomAuthorityContract = require('../random/ServerRandomAuthorityContract');

const DOMAIN = 'defenderLeader';
const DEFAULT_ACTION = 'leaderGeneration';

function sanitizeText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function createLeaderSeed(territory = {}) {
  return [
    'defender',
    sanitizeText(territory.id || territory.naturalName, 'site'),
    sanitizeText(territory.owner, 'neutral'),
    Math.max(0, Math.floor(Number(territory.threat) || 0)),
    Math.max(0, Math.floor(Number(territory.defense) || 0)),
  ].join(':');
}

function createLeaderSubjectId(territory = {}) {
  return [
    'leader',
    sanitizeText(territory.id || territory.naturalName, 'site'),
    sanitizeText(territory.owner, 'neutral'),
  ].join(':');
}

function createLeaderRandomSource(territory = {}, options = {}) {
  const seed = sanitizeText(options.seed, createLeaderSeed(territory));
  const subjectId = sanitizeText(options.subjectId, createLeaderSubjectId(territory));
  return ServerRandomAuthorityContract.createRandomSource({
    domain: DOMAIN,
    action: sanitizeText(options.action, DEFAULT_ACTION),
    subjectId,
    seed,
  }, {
    now: options.now || options.createdAt,
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
    domain: scope.domain,
    action: scope.action,
    subjectId: scope.subjectId,
    seed: scope.seed,
  };
}

module.exports = {
  DEFAULT_ACTION,
  DOMAIN,
  createLeaderRandomSource,
  createLeaderSeed,
  createLeaderSubjectId,
  createSourceMetadata,
  getAuthorityScope,
};
