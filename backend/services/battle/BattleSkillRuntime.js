const {
  clone,
  toInteger,
} = require('./BattleShared');
const {
  createFloatingText,
  getStatusLabel,
  getStatusTurns,
  getStatusValue,
} = require('./BattleStatuses');

function getSkillCooldown(skill = {}) {
  return Math.max(2, toInteger(skill.cooldown, 3));
}

function getSkillEffectMultiplier(skill = {}, key, fallback = 0) {
  const effect = Array.isArray(skill.effects) ? skill.effects.find((item) => item?.key === key) : null;
  const value = effect?.multiplier ?? effect?.value;
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function applyAttributeBonus(unit, effect = {}) {
  const attribute = effect.attribute || effect.keyAttribute;
  const value = toInteger(effect.value, 0);
  if (!attribute || value === 0) return null;
  const before = toInteger(unit.attributes?.[attribute], 0);
  unit.attributes = { ...unit.attributes, [attribute]: before + value };
  if (attribute === 'intelligence') unit.attributes.strategy = unit.attributes.intelligence;
  if (attribute === 'strategy') unit.attributes.intelligence = unit.attributes.strategy;
  return {
    type: 'attributeBonus',
    target: unit.side,
    attribute,
    value,
    before,
    after: unit.attributes[attribute],
    text: `[${unit.name}] ${attribute} +${value}（${unit.attributes[attribute]}）`,
  };
}

function getSoldierRatio(unit) {
  return unit.maxSoldiers > 0 ? unit.soldiers / unit.maxSoldiers : 0;
}

function hasStatus(unit, key) {
  if (!key) return false;
  return Array.isArray(unit.statuses) && unit.statuses.some((status) => status?.key === key);
}

function isCastConditionMet(condition = {}, unit, target) {
  if (!condition || typeof condition !== 'object') return true;
  const threshold = Number(condition.value ?? condition.pct ?? condition.threshold);
  switch (condition.type) {
    case 'cooldownReady':
      return unit.skillCooldownRemaining <= 0;
    case 'targetAlive':
      return target.soldiers > 0;
    case 'selfSoldierBelowPct':
      return getSoldierRatio(unit) < (Number.isFinite(threshold) ? threshold : 1);
    case 'selfSoldierAbovePct':
      return getSoldierRatio(unit) > (Number.isFinite(threshold) ? threshold : 0);
    case 'targetSoldierBelowPct':
      return getSoldierRatio(target) < (Number.isFinite(threshold) ? threshold : 1);
    case 'targetHasStatus':
      return hasStatus(target, condition.key || condition.status);
    case 'selfHasStatus':
      return hasStatus(unit, condition.key || condition.status);
    case 'firstOwnAction':
      return toInteger(unit.ownActionCount, 0) === 0;
    default:
      return true;
  }
}

function canCastSkill(unit, target, skill = null) {
  if (!skill || unit.skillCooldownRemaining > 0 || target.soldiers <= 0) return false;
  const conditions = Array.isArray(skill.castConditions) && skill.castConditions.length
    ? skill.castConditions
    : [{ type: 'cooldownReady' }, { type: 'targetAlive' }];
  return conditions.every((condition) => isCastConditionMet(condition, unit, target));
}

function getSkillCastConditionResults(unit, target, skill = null) {
  if (!skill) return [];
  const conditions = Array.isArray(skill.castConditions) && skill.castConditions.length
    ? skill.castConditions
    : [{ type: 'cooldownReady' }, { type: 'targetAlive' }];
  return conditions.map((condition) => ({
    ...condition,
    met: isCastConditionMet(condition, unit, target),
  }));
}

function describeActionDecision(unit, target, skill = null) {
  if (!skill) {
    return {
      skillId: '',
      skillName: '',
      canCast: false,
      reason: 'noActiveSkill',
      conditionResults: [],
      cooldownRemaining: 0,
      ownActionCountBefore: toInteger(unit.ownActionCount, 0),
    };
  }
  const conditionResults = getSkillCastConditionResults(unit, target, skill);
  const cooldownRemaining = Math.max(0, toInteger(unit.skillCooldownRemaining, 0));
  const targetAlive = target.soldiers > 0;
  const canCast = cooldownRemaining <= 0 && targetAlive && conditionResults.every((condition) => condition.met);
  const failed = conditionResults.find((condition) => !condition.met);
  return {
    skillId: skill.id || '',
    skillName: skill.name || '',
    canCast,
    reason: canCast
      ? 'castSkill'
      : (cooldownRemaining > 0 ? 'cooldownNotReady' : (!targetAlive ? 'targetDefeated' : `conditionNotMet:${failed?.type || 'unknown'}`)),
    conditionResults,
    cooldownRemaining,
    ownActionCountBefore: toInteger(unit.ownActionCount, 0),
  };
}

function createBattleSkillRuntime({
  getPassiveTraitsFromAbilityKit,
  healSoldiers,
  applyStatusToUnit,
} = {}) {
  const getPassiveTraits = typeof getPassiveTraitsFromAbilityKit === 'function'
    ? getPassiveTraitsFromAbilityKit
    : () => [];
  const heal = typeof healSoldiers === 'function'
    ? healSoldiers
    : () => 0;
  const applyStatus = typeof applyStatusToUnit === 'function'
    ? applyStatusToUnit
    : () => null;

  function applyPreBattlePassives(unit) {
    const traits = getPassiveTraits(unit.leader?.abilityKit);
    const events = [];
    traits.forEach((trait) => {
      const effects = Array.isArray(trait.effects) ? trait.effects : [];
      const applied = effects
        .map((effect) => {
          if (effect?.key === 'attributeBonus') return applyAttributeBonus(unit, effect);
          return null;
        })
        .filter(Boolean);
      if (applied.length) {
        events.push({
          phase: 'preparation',
          type: 'passiveTrait',
          actor: unit.side,
          actorName: unit.name,
          traitId: trait.id || '',
          traitName: trait.name || '被动特质',
          effects: applied,
          lines: [
            `[${unit.name}] 触发被动 [${trait.name || '被动特质'}]`,
            ...applied.map((effect) => effect.text),
          ],
        });
      }
    });
    return events;
  }

  function applySkillSideEffects(unit, target, skill = {}, dealt = 0) {
    const effects = Array.isArray(skill.effects) ? skill.effects : [];
    const notes = [];
    const structured = [];
    effects.forEach((effect) => {
      if (!effect || typeof effect !== 'object') return;
      if (effect.key === 'lifesteal') {
        const recovered = heal(unit, Math.round(dealt * (Number(effect.value) || 0)));
        if (recovered > 0) {
          notes.push(`恢复 ${recovered} 士兵`);
          structured.push({ type: 'heal', target: unit.side, value: recovered, text: `[${unit.name}] 恢复兵力 ${recovered}（${unit.soldiers}）` });
        }
      } else if (effect.key === 'heal') {
        const recovered = heal(unit, Math.round(unit.maxSoldiers * (Number(effect.value) || 0)));
        if (recovered > 0) {
          notes.push(`整队恢复 ${recovered} 士兵`);
          structured.push({ type: 'heal', target: unit.side, value: recovered, text: `[${unit.name}] 整队恢复兵力 ${recovered}（${unit.soldiers}）` });
        }
      } else if (effect.key === 'shield') {
        const applied = applyStatus(unit, {
          key: 'shield',
          value: getStatusValue(effect),
          turnsRemaining: getStatusTurns(effect),
          sourceSkillId: skill.id || '',
          sourceSkillName: skill.name || '',
          sourceSide: unit.side,
          targetSide: unit.side,
        });
        if (applied) {
          notes.push(`获得守御 ${applied.value}`);
          structured.push(applied);
        }
      } else if (effect.key === 'attributeBonus') {
        const applied = applyAttributeBonus(unit, effect);
        if (applied) {
          structured.push({
            ...applied,
            type: 'buff',
            floatingText: createFloatingText(`${applied.attribute} +${applied.value}`, unit.side, 'buff'),
          });
          notes.push('属性提升');
        }
      } else if (effect.key === 'morale') {
        structured.push({ type: 'morale', target: unit.side, value: unit.morale, text: `[${unit.name}] 士气保持 ${unit.morale}` });
        notes.push('士气保持');
      } else if (effect.key === 'armorBreak') {
        const applied = applyStatus(target, {
          key: 'armorBreak',
          value: getStatusValue(effect),
          turnsRemaining: getStatusTurns(effect),
          maxStacks: effect.maxStacks,
          sourceSkillId: skill.id || '',
          sourceSkillName: skill.name || '',
          sourceSide: unit.side,
          targetSide: target.side,
          appliedAtRound: unit.ownActionCount + 1,
        });
        if (applied) {
          structured.push(applied);
          notes.push('破甲');
        }
      } else if (effect.key === 'burn' || effect.key === 'poison') {
        const applied = applyStatus(target, {
          key: effect.key,
          value: getStatusValue(effect),
          turnsRemaining: getStatusTurns(effect),
          maxStacks: effect.maxStacks,
          sourceSkillId: skill.id || '',
          sourceSkillName: skill.name || '',
          sourceSide: unit.side,
          targetSide: target.side,
          sourceAttributes: clone(unit.attributes || {}),
          appliedAtRound: unit.ownActionCount + 1,
        });
        if (applied) {
          structured.push(applied);
          notes.push(getStatusLabel(effect.key));
        }
      }
    });
    return { notes, structured };
  }

  return {
    applyPreBattlePassives,
    applySkillSideEffects,
    canCastSkill,
    describeActionDecision,
    getSkillCooldown,
    getSkillEffectMultiplier,
  };
}

module.exports = {
  applyAttributeBonus,
  canCastSkill,
  createBattleSkillRuntime,
  describeActionDecision,
  getSkillCastConditionResults,
  getSkillCooldown,
  getSkillEffectMultiplier,
  getSoldierRatio,
  hasStatus,
  isCastConditionMet,
};
