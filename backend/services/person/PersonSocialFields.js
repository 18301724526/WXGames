// PersonSocialFields — normalize the SOCIAL layer of a person (docs/design/02, 03; decisions 08):
// personality (气性 + 多维相性 axes), gender + orientation (decision 03-1), the relationship edge
// list, and factionId (or 在野/ronin). Extracted as its own module because FamousPersonService is at
// its god-file line limit — normalizePerson delegates here with a single `...normalizeSocial(raw, id)`
// spread (see docs/design/09 for the one-line wiring step + the room-making it needs).
//
// Single source: personality axes are authoritative (nature re-derived), relationships are the
// person's own directed edges (relationshipCore), factionId is the person's membership. Deterministic
// from the person id seed so old saves backfill consistently. Config from ConfigTables; overridable
// for tests.

const personalityCore = require('../../../shared/person/personalityCore');
const relationshipCore = require('../../../shared/person/relationshipCore');
const ConfigTables = require('../../config/ConfigTables');

const GENDERS = ['male', 'female'];
const ORIENTATIONS = ['hetero', 'same'];

function loadNatures(opts) {
  return (opts && opts.natures) || ConfigTables.getRows('personality_natures');
}
function loadTuning(opts) {
  if (opts && opts.tuning) return opts.tuning;
  return Object.fromEntries(ConfigTables.getRows('personality_tuning').map((r) => [r.paramKey, r.value]));
}
function loadRelTuning(opts) {
  if (opts && opts.relTuning) return opts.relTuning;
  return Object.fromEntries(ConfigTables.getRows('relationship_tuning').map((r) => [r.paramKey, r.value]));
}

function tuningVal(tuning, key, fallback) {
  const n = Number(tuning ? tuning[key] : undefined);
  return Number.isFinite(n) ? n : fallback;
}

function assignGender(seed, tuning) {
  const prng = personalityCore.makePrng(`${seed}:gender`);
  return prng() < tuningVal(tuning, 'genderFemaleRatio', 0.18) ? 'female' : 'male';
}

function assignOrientation(seed, tuning) {
  const prng = personalityCore.makePrng(`${seed}:orientation`);
  return prng() < tuningVal(tuning, 'orientationSameSexRatio', 0.05) ? 'same' : 'hetero';
}

// Normalize (or, for old saves lacking them, deterministically backfill) the social fields for a
// person. `seed` is the person id. Returns exactly the social sub-object to spread onto the person.
function normalizeSocial(raw = {}, seed = '', opts = {}) {
  const natures = loadNatures(opts);
  const tuning = loadTuning(opts);
  const personality = raw.personality && raw.personality.axes
    ? personalityCore.normalizePersonality(raw.personality, natures)
    : personalityCore.assignPersonality(seed, natures, tuning);
  const gender = GENDERS.includes(raw.gender) ? raw.gender : assignGender(seed, tuning);
  const orientation = ORIENTATIONS.includes(raw.orientation) ? raw.orientation : assignOrientation(seed, tuning);
  const relTuning = loadRelTuning(opts);
  const relationships = Array.isArray(raw.relationships)
    ? raw.relationships.map((e) => relationshipCore.withResolvedKind(e, relTuning)).filter((e) => e.toPersonId)
    : [];
  const factionId = raw.factionId ? String(raw.factionId) : null; // null = 在野(ronin)
  return { personality, gender, orientation, relationships, factionId };
}

module.exports = {
  GENDERS,
  ORIENTATIONS,
  assignGender,
  assignOrientation,
  normalizeSocial,
};
