const {
  getTileId,
  toInteger,
} = require('./WorldMapShared');

const SCHEMA = 'world-fog-vision-history-v1';
const VERSION = 1;
const DEFAULT_SAMPLE_STEP_TILES = 0.45;
const MAX_HISTORY_SOURCES = 4096;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeKind(value = '') {
  return value === 'city' ? 'city' : 'unit';
}

function normalizeCoord(source = {}, fallback = {}) {
  const q = toNumber(source.q ?? source.x, toNumber(fallback.q ?? fallback.x, 0));
  const r = toNumber(source.r ?? source.y, toNumber(fallback.r ?? fallback.y, 0));
  return {
    q,
    r,
    tileId: Number.isInteger(q) && Number.isInteger(r)
      ? getTileId(q, r)
      : getTileId(Math.floor(q), Math.floor(r)),
  };
}

function getSourceKey(source = {}) {
  return [
    normalizeKind(source.kind),
    Math.round(toNumber(source.q) * 100),
    Math.round(toNumber(source.r) * 100),
  ].join(':');
}

function normalizeSource(source = {}, fallback = {}) {
  if (!source || typeof source !== 'object') return null;
  const coord = normalizeCoord(source, fallback);
  const kind = normalizeKind(source.kind || fallback.kind);
  return {
    kind,
    q: coord.q,
    r: coord.r,
    tileId: coord.tileId,
    revealedAt: source.revealedAt || fallback.revealedAt || null,
  };
}

function hashStep(hash, value) {
  const text = String(value ?? '');
  let next = hash >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

function normalizeHistory(input = {}) {
  const rawSources = Array.isArray(input)
    ? input
    : (Array.isArray(input?.sources) ? input.sources : []);
  const byKey = new Map();
  rawSources.forEach((source) => {
    const normalized = normalizeSource(source);
    if (!normalized) return;
    byKey.set(getSourceKey(normalized), normalized);
  });
  const sources = [...byKey.values()].slice(-MAX_HISTORY_SOURCES);
  let hash = 2166136261;
  sources.forEach((source) => {
    hash = hashStep(hash, source.kind);
    hash = hashStep(hash, Math.round(source.q * 100));
    hash = hashStep(hash, Math.round(source.r * 100));
  });
  return {
    schema: SCHEMA,
    version: VERSION,
    sources,
    signature: `${VERSION}:${sources.length}:${(hash >>> 0).toString(16)}`,
  };
}

function getWorldMap(target = {}) {
  if (target?.worldMap && typeof target.worldMap === 'object') return target.worldMap;
  if (target && typeof target === 'object' && Array.isArray(target.tiles)) return target;
  return null;
}

function setHistory(worldMap, history) {
  if (!worldMap) return null;
  worldMap.visionHistory = normalizeHistory(history);
  return worldMap.visionHistory;
}

function recordSource(target = {}, source = {}, now = new Date()) {
  const worldMap = getWorldMap(target);
  if (!worldMap) return null;
  const revealedAt = typeof now === 'string' ? now : now?.toISOString?.() || null;
  const history = normalizeHistory(worldMap.visionHistory || worldMap.visionHistorySources);
  return setHistory(worldMap, {
    sources: [
      ...history.sources,
      normalizeSource(source, { revealedAt }),
    ].filter(Boolean),
  });
}

function samplePath(from = {}, to = {}, options = {}) {
  const start = normalizeCoord(from, to);
  const end = normalizeCoord(to, start);
  const stepSize = Math.max(0.1, toNumber(options.sampleStepTiles, DEFAULT_SAMPLE_STEP_TILES));
  const distance = Math.hypot(end.q - start.q, end.r - start.r);
  const steps = Math.max(1, Math.ceil(distance / stepSize));
  const samples = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    samples.push({
      q: start.q + (end.q - start.q) * t,
      r: start.r + (end.r - start.r) * t,
    });
  }
  return samples;
}

function recordPath(target = {}, path = {}, now = new Date(), options = {}) {
  const worldMap = getWorldMap(target);
  if (!worldMap) return null;
  const kind = normalizeKind(path.kind);
  const revealedAt = typeof now === 'string' ? now : now?.toISOString?.() || null;
  const history = normalizeHistory(worldMap.visionHistory || worldMap.visionHistorySources);
  const sources = [...history.sources];
  samplePath(path.from || path.to, path.to || path.from, options).forEach((coord) => {
    sources.push(normalizeSource({ ...coord, kind }, { revealedAt }));
  });
  return setHistory(worldMap, { sources });
}

module.exports = {
  DEFAULT_SAMPLE_STEP_TILES,
  MAX_HISTORY_SOURCES,
  SCHEMA,
  VERSION,
  getSourceKey,
  normalizeCoord,
  normalizeHistory,
  normalizeSource,
  recordPath,
  recordSource,
  samplePath,
};
