const SkillGeneratorService = require('../SkillGeneratorService');
const { sanitizeText, toInteger } = require('./FamousPersonShared');
const { makeSkillName } = require('./FamousPersonGenerator');

function normalizeSkill(raw = {}) {
  const effects = Array.isArray(raw.effects)
    ? raw.effects.map((effect) => SkillGeneratorService.normalizeEffect(effect)).filter(Boolean)
    : [];
  if (!effects.length) return null;
  return {
    id: sanitizeText(raw.id, `skill_${effects.map((effect) => effect.key).join('_')}`),
    name: sanitizeText(raw.name, makeSkillName(effects)),
    type: sanitizeText(raw.type, 'battle'),
    slot: sanitizeText(raw.slot, raw.kind === 'active' ? 'activeSkill' : ''),
    kind: sanitizeText(raw.kind, raw.type === 'battle' ? 'active' : ''),
    category: sanitizeText(raw.category, raw.damageType || 'blade'),
    damageType: sanitizeText(raw.damageType, raw.category || 'blade'),
    multiplier: Number.isFinite(Number(raw.multiplier)) ? Number(raw.multiplier) : undefined,
    cooldown: Number.isFinite(Number(raw.cooldown))
      ? Math.max(1, toInteger(raw.cooldown, 3))
      : undefined,
    castPolicy: sanitizeText(raw.castPolicy, ''),
    castConditions: Array.isArray(raw.castConditions)
      ? raw.castConditions.map((condition) => ({ ...condition }))
      : undefined,
    effects,
    budget: raw.budget && typeof raw.budget === 'object' ? { ...raw.budget } : undefined,
    generatorVersion: sanitizeText(raw.generatorVersion, ''),
  };
}

module.exports = {
  normalizeSkill,
};
