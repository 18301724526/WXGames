const ServerRandomAuthorityContract = require('../random/ServerRandomAuthorityContract');
const {
  sanitizeText,
} = require('./FamousPersonShared');

const SCOPE = 'famousPerson';
const DEFAULT_ACTION = 'candidateGeneration';

function normalizeDate(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function createCandidateSeed(gameState = {}, sourceType = 'seek', now = new Date()) {
  const date = normalizeDate(now);
  return [
    sanitizeText(gameState.playerId, 'player'),
    sanitizeText(sourceType, 'seek'),
    date.getTime(),
    sanitizeText(gameState.activeCityId, 'capital'),
  ].join(':');
}

function createCandidateSubjectId(gameState = {}, sourceType = 'seek') {
  return [
    'candidate',
    sanitizeText(gameState.playerId, 'player'),
    sanitizeText(sourceType, 'seek'),
    sanitizeText(gameState.activeCityId, 'capital'),
  ].join(':');
}

function createCandidateRandomSource(gameState = {}, sourceType = 'seek', now = new Date(), options = {}) {
  const seed = sanitizeText(options.seed, createCandidateSeed(gameState, sourceType, now));
  const subjectId = sanitizeText(options.subjectId, createCandidateSubjectId(gameState, sourceType));
  return ServerRandomAuthorityContract.createRandomSource({
    scope: SCOPE,
    action: sanitizeText(options.action, DEFAULT_ACTION),
    subjectId,
    seed,
  }, {
    now,
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
  createCandidateRandomSource,
  createCandidateSeed,
  createCandidateSubjectId,
  createSourceMetadata,
  getAuthorityScope,
};
