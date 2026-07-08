const {
  EFFECT_LABELS,
} = require('./SkillGeneratorConstants');
const {
  sanitizeText,
} = require('./SkillGeneratorShared');

function describeEffects(effects = []) {
  return effects
    .map((effect) => EFFECT_LABELS[effect?.key] || effect?.key)
    .filter(Boolean)
    .join(' / ');
}

function getAttributeLabel(key = '') {
  return {
    command: '统帅',
    force: '武力',
    intelligence: '智力',
    strategy: '智力',
    politics: '政治',
    charisma: '魅力',
    speed: '速度',
  }[key] || key || '属性';
}

function formatPercent(value, fallback = 0) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return `${Math.round(numeric * 100)}%`;
}

function describeEffectSentence(effect = {}, ability = {}) {
  if (effect.key === 'directDamage') {
    return ability.damageType === 'strategy'
      ? '发动战法攻击目标，造成一次谋略伤害。'
      : '发动战法攻击目标，造成一次兵刃伤害。';
  }
  if (effect.key === 'secondHit') return '造成伤害后追加一次追击（追击：根据本次攻击的一部分伤害再次打击目标）。';
  if (effect.key === 'firstStrike') return '首次出手时抢先压制目标，并追加一次先机打击。';
  if (effect.key === 'lifesteal') return '施加倒戈（倒戈：将敌方本次损失兵力的一部分转换为自己的兵力）。';
  if (effect.key === 'heal') return '恢复我方一部分兵力。';
  if (effect.key === 'shield') return '获得守御，可抵消一部分伤害。';
  if (effect.key === 'armorBreak') return '对目标施加破甲（破甲：目标后续受到的兵刃伤害提高）。';
  if (effect.key === 'burn') return '对目标施加灼烧（灼烧：目标行动前会损失兵力）。';
  if (effect.key === 'poison') return '对目标施加中毒（中毒：目标行动前会持续损失兵力）。';
  if (effect.key === 'attributeBonus') {
    const attribute = getAttributeLabel(effect.attribute || effect.keyAttribute);
    const value = Math.round(Number(effect.value) || 0);
    if (ability.kind === 'passive' || ability.slot === 'passiveTrait') return `战斗开始前，自己的${attribute}提高 ${value} 点。`;
    return `发动后，本场战斗中自己的${attribute}提高 ${value} 点。`;
  }
  if (effect.key === 'resourceOutputPct') return `${effect.resource === 'food' ? '粮食' : '资源'}产出提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'allBasicOutputPct') return `基础资源产出提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'constructionSpeedPct') return `建造速度提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'constructionCostPct') return `建造消耗降低 ${formatPercent(effect.value)}。`;
  if (effect.key === 'knowledgeOutputPct') return `知识产出提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'populationCapPct') return `人口上限提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'happinessFlat') return `幸福度提高 ${Math.round(Number(effect.value) || 0)} 点。`;
  if (effect.key === 'trainingSpeedPct') return `训练速度提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'eventRewardPct') return `事件奖励提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'eventRiskReductionPct') return `事件风险降低 ${formatPercent(effect.value)}。`;
  if (effect.key === 'settlementPacifyPct') return `安抚效率提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'famousRetentionPct') return `名人说服成功率提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'diplomacyBonusPct') return `外交收益提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'scoutReportBonusPct') return `军情视野质量提高 ${formatPercent(effect.value)}。`;
  if (effect.key === 'cityStabilityPct') return `城市稳定提高 ${formatPercent(effect.value)}。`;
  return '';
}

function describePlayerFacingEffects(ability = {}) {
  const effects = Array.isArray(ability.effects) ? ability.effects : [];
  const hasDirectDamage = effects.some((effect) => effect?.key === 'directDamage');
  const hasLifesteal = effects.some((effect) => effect?.key === 'lifesteal');
  if (hasDirectDamage && hasLifesteal) {
    const damageText = ability.damageType === 'strategy' ? '谋略伤害' : '兵刃伤害';
    return `发动战法攻击目标，造成一次${damageText}，并施加倒戈（倒戈：将敌方本次损失兵力的一部分转换为自己的兵力）。`;
  }
  return effects.map((effect) => describeEffectSentence(effect, ability)).filter(Boolean).join('');
}

function describeAbility(ability = {}) {
  return describePlayerFacingEffects(ability) || describeEffects(ability.effects) || '暂无具体效果。';
}

function sanitizeAbilityDescription(value = '') {
  const text = sanitizeText(value);
  if (!text) return '';
  if (/自身行动|冷却\s*\d*\s*次|冷却就绪|目标存活|直接伤害|属性修正|二段伤害|吸血|当前阶段|当前仅展示|后续接入|实际收益|实际侦查|再次释放|等自己出手|再出手|才能再放|再放前/.test(text)) {
    return '';
  }
  return text;
}

function withAbilityDescription(ability = {}) {
  const fallback = describeAbility(ability);
  const existing = sanitizeAbilityDescription(ability.description);
  return {
    ...ability,
    description: existing || fallback,
  };
}

module.exports = {
  describeAbility,
  describeEffectSentence,
  describeEffects,
  describePlayerFacingEffects,
  formatPercent,
  getAttributeLabel,
  sanitizeAbilityDescription,
  withAbilityDescription,
};
