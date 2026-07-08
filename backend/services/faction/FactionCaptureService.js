// FactionCaptureService — backend orchestration for 占城捕获招降 (②b, docs garrison + design 03/08).
// Turns real person/faction data into the pure captureCore inputs: on a garrison-battle victory it
// rolls capture (garrison band captureChance), and for 招降 computes the success chance from the
// garrison band's recruitBaseRate + the recruiting ruler's 魅力, the ruler↔captive 相性
// (personalityCore.compatScore over their personality axes), and the captive's relationship ties in
// the recruiter's ranks (relationshipCore.recruitModifier / 宿敌 → 宁死不降). Disposition
// (斩杀/招降/放生) resolves via captureCore. The actual roster mutation (acceptFamousPerson on a
// successful 招降) + battle-victory hook + panel UI are wired by the caller — this service is the
// pure decision layer, so it's fully testable without the battle/DB.
//
// Single source: it READS persons/factions/relationships (never duplicates them) and returns a
// decision; config from ConfigTables (overridable for tests).

const captureCore = require('../../../shared/faction/captureCore');
const personalityCore = require('../../../shared/person/personalityCore');
const relationshipCore = require('../../../shared/person/relationshipCore');
const ConfigTables = require('../../config/ConfigTables');

function tuningMap(table, opts, key) {
  if (opts && opts[key]) return opts[key];
  return Object.fromEntries(ConfigTables.getRows(table).map((r) => [r.paramKey, r.value]));
}

function createFactionCaptureService(_deps = {}) {
  function config(opts) {
    return {
      personalityTuning: tuningMap('personality_tuning', opts, 'personalityTuning'),
      relTuning: tuningMap('relationship_tuning', opts, 'relTuning'),
      captureTuning: tuningMap('capture_tuning', opts, 'captureTuning'),
    };
  }

  // Did the defeated defender get captured? garrisonBand.captureChance in 0..1, roll in [0,1).
  function rollCapture(garrisonBand, roll) {
    return captureCore.rollCapture(garrisonBand && garrisonBand.captureChance, roll);
  }

  // Compute the 招降 success chance for a captive general.
  //   captive         : the defeated defender person (has personality.axes + relationships).
  //   recruiterRuler  : the recruiting faction's ruler person (魅力 + personality.axes). null => 0 bonuses.
  //   inFactionKind   : (toPersonId) => relationship kind if that person serves the recruiter, else null.
  //   garrisonBand    : the garrison config row (recruitBaseRate).
  function recruitChance(captive, recruiterRuler, inFactionKind, garrisonBand, opts = {}) {
    const cfg = config(opts);
    const captiveAxes = captive && captive.personality ? captive.personality.axes : null;
    const rulerAxes = recruiterRuler && recruiterRuler.personality ? recruiterRuler.personality.axes : null;
    const rulerCaptiveCompat = captiveAxes && rulerAxes
      ? personalityCore.compatScore(rulerAxes, captiveAxes, cfg.personalityTuning)
      : 0;
    const rels = captive && Array.isArray(captive.relationships) ? captive.relationships : [];
    const resolve = typeof inFactionKind === 'function' ? inFactionKind : () => null;
    const relationshipModifier = relationshipCore.recruitModifier(rels, resolve, cfg.relTuning);
    const nemesisInArmy = rels.some((e) => resolve(e.toPersonId) === relationshipCore.KIND.NEMESIS);
    return captureCore.recruitSuccessChance({
      recruitBaseRate: garrisonBand && garrisonBand.recruitBaseRate,
      rulerCharisma: recruiterRuler && recruiterRuler.attributes ? recruiterRuler.attributes.charisma : 0,
      rulerCaptiveCompat,
      relationshipModifier,
      nemesisInArmy,
    }, cfg.captureTuning);
  }

  // Resolve the player's panel choice into an outcome. For 'recruit' the caller passes the chance
  // (from recruitChance) + a [0,1) roll; the returned outcome tells the caller whether to run
  // acceptFamousPerson (joinsFaction) or drop the captive.
  function resolveDisposition(choice, chance, roll, opts = {}) {
    const cfg = config(opts);
    const recruitSucceeded = choice === 'recruit' ? captureCore.rollRecruit(chance, roll) : false;
    const outcome = captureCore.dispositionOutcome(choice, recruitSucceeded, cfg.captureTuning);
    return { ...outcome, recruitChance: choice === 'recruit' ? chance : null };
  }

  return { rollCapture, recruitChance, resolveDisposition };
}

module.exports = { createFactionCaptureService };
