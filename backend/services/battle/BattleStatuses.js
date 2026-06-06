const {
  clone,
  toInteger,
} = require('./BattleShared');

const STATUS_RULES = Object.freeze({
  shield: {
    label: '守御',
    defaultValue: 0.08,
    defaultTurns: 2,
    maxValuePct: 0.3,
    maxStacks: 1,
  },
  armorBreak: {
    label: '破甲',
    defaultValue: 0.12,
    defaultTurns: 2,
    maxStacks: 3,
    maxTotalValue: 0.3,
  },
  burn: {
    label: '灼烧',
    defaultValue: 0.12,
    defaultTurns: 2,
    maxStacks: 3,
    damageType: 'strategy',
  },
  poison: {
    label: '中毒',
    defaultValue: 0.12,
    defaultTurns: 2,
    maxStacks: 3,
    damageType: 'strategy',
  },
});

function getStatusRule(key = '') {
  return STATUS_RULES[key] || null;
}

function getStatusLabel(key = '') {
  return getStatusRule(key)?.label || key || '状态';
}

function createFloatingText(text, target, kind = 'status') {
  return {
    text,
    target,
    kind,
  };
}

function getStatusTurns(effect = {}) {
  const rule = getStatusRule(effect.key);
  const turns = toInteger(effect.turns ?? effect.duration ?? effect.turnsRemaining, rule?.defaultTurns || 2);
  return Math.max(1, turns);
}

function getStatusValue(effect = {}) {
  const rule = getStatusRule(effect.key);
  const value = Number(effect.value ?? effect.multiplier);
  return Number.isFinite(value) ? value : (rule?.defaultValue || 0);
}

function normalizeStatus(raw = {}, fallback = {}) {
  const key = raw.key || fallback.key || '';
  const rule = getStatusRule(key);
  if (!rule) return null;
  const value = Number(raw.value ?? fallback.value ?? rule.defaultValue);
  const stacks = Math.max(1, toInteger(raw.stacks ?? fallback.stacks, 1));
  const maxStacks = Math.max(1, toInteger(raw.maxStacks ?? fallback.maxStacks, rule.maxStacks || 1));
  return {
    key,
    label: raw.label || rule.label,
    sourceSkillId: raw.sourceSkillId || fallback.sourceSkillId || '',
    sourceSkillName: raw.sourceSkillName || fallback.sourceSkillName || '',
    sourceSide: raw.sourceSide || fallback.sourceSide || '',
    targetSide: raw.targetSide || fallback.targetSide || '',
    turnsRemaining: Math.max(0, toInteger(raw.turnsRemaining ?? fallback.turnsRemaining, rule.defaultTurns || 1)),
    stacks: Math.min(maxStacks, stacks),
    maxStacks,
    value: Number.isFinite(value) ? value : rule.defaultValue,
    stackPolicy: raw.stackPolicy || fallback.stackPolicy || (key === 'shield' ? 'value' : 'stack'),
    appliedAtRound: toInteger(raw.appliedAtRound ?? fallback.appliedAtRound, 0),
    sourceAttributes: raw.sourceAttributes || fallback.sourceAttributes ? clone(raw.sourceAttributes || fallback.sourceAttributes) : null,
    shieldRemaining: Math.max(0, toInteger(raw.shieldRemaining ?? fallback.shieldRemaining, 0)),
    maxShield: Math.max(0, toInteger(raw.maxShield ?? fallback.maxShield, 0)),
  };
}

function normalizeStatuses(statuses = []) {
  if (!Array.isArray(statuses)) return [];
  return statuses.map((status) => normalizeStatus(status)).filter(Boolean);
}

function sanitizeStatuses(statuses = []) {
  return normalizeStatuses(statuses).filter((status) => (
    status
    && (status.key === 'shield' ? status.shieldRemaining > 0 : status.turnsRemaining > 0)
  ));
}

function getStatusTotalValue(unit, key) {
  const rule = getStatusRule(key);
  if (!rule || !Array.isArray(unit.statuses)) return 0;
  const total = unit.statuses
    .filter((status) => status?.key === key)
    .reduce((sum, status) => sum + (Number(status.value) || 0) * Math.max(1, toInteger(status.stacks, 1)), 0);
  return Number.isFinite(rule.maxTotalValue) ? Math.min(rule.maxTotalValue, total) : total;
}

function applyDamage(target, damage) {
  const actual = Math.max(0, Math.min(target.soldiers, Math.floor(Number(damage) || 0)));
  target.soldiers = Math.max(0, target.soldiers - actual);
  return actual;
}

function healSoldiers(unit, amount) {
  const recovered = Math.max(0, Math.min(unit.maxSoldiers - unit.soldiers, Math.floor(Number(amount) || 0)));
  unit.soldiers += recovered;
  return recovered;
}

function createBattleStatuses({ defaultSoldierScale, calculateDamage } = {}) {
  const soldierScale = Math.max(1, toInteger(defaultSoldierScale, 100));
  const calculateStatusDamage = typeof calculateDamage === 'function'
    ? calculateDamage
    : () => 0;

  function consumeShield(target, incomingDamage) {
    let remaining = Math.max(0, Math.floor(Number(incomingDamage) || 0));
    let absorbed = 0;
    if (!remaining || !Array.isArray(target.statuses)) return { damage: remaining, absorbed, events: [] };
    const events = [];
    target.statuses.forEach((status) => {
      if (status?.key !== 'shield' || status.shieldRemaining <= 0 || remaining <= 0) return;
      const used = Math.min(status.shieldRemaining, remaining);
      status.shieldRemaining -= used;
      remaining -= used;
      absorbed += used;
      events.push({
        type: 'shieldAbsorb',
        key: 'shield',
        target: target.side,
        targetName: target.name,
        value: used,
        remaining: status.shieldRemaining,
        text: `[${target.name}] 守御抵消 ${used} 伤害`,
        floatingText: createFloatingText(`守御抵消 ${used}`, target.side, 'shield'),
      });
    });
    target.statuses = target.statuses.filter((status) => status?.key !== 'shield' || status.shieldRemaining > 0);
    return { damage: remaining, absorbed, events };
  }

  function applyDamageWithStatuses(target, damage) {
    const shield = consumeShield(target, damage);
    const dealt = applyDamage(target, shield.damage);
    return {
      attempted: Math.max(0, Math.floor(Number(damage) || 0)),
      dealt,
      absorbed: shield.absorbed,
      shieldEvents: shield.events,
    };
  }

  function removeExpiredStatuses(unit) {
    const removed = [];
    unit.statuses = normalizeStatuses(unit.statuses).filter((status) => {
      const keep = status.key === 'shield' ? status.shieldRemaining > 0 : status.turnsRemaining > 0;
      if (!keep) {
        removed.push({
          type: 'statusExpired',
          key: status.key,
          label: status.label || getStatusLabel(status.key),
          target: unit.side,
          targetName: unit.name,
          text: `[${unit.name}] ${status.label || getStatusLabel(status.key)}结束`,
        });
      }
      return keep;
    });
    return removed;
  }

  function clearUnitStatuses(unit, reason = 'defeated') {
    const statuses = sanitizeStatuses(unit.statuses);
    unit.statuses = [];
    if (!statuses.length) return [];
    return statuses.map((status) => ({
      type: 'statusCleared',
      key: status.key,
      label: status.label || getStatusLabel(status.key),
      target: unit.side,
      targetName: unit.name,
      reason,
      text: `[${unit.name}] ${status.label || getStatusLabel(status.key)}消散`,
    }));
  }

  function clearDefeatedStatuses(attacker, defender) {
    return [
      ...(attacker.soldiers <= 0 ? clearUnitStatuses(attacker, 'defeated') : []),
      ...(defender.soldiers <= 0 ? clearUnitStatuses(defender, 'defeated') : []),
    ];
  }

  function applyStatusToUnit(unit, statusInput = {}) {
    const status = normalizeStatus(statusInput);
    if (!status) return null;
    unit.statuses = sanitizeStatuses(unit.statuses);
    const rule = getStatusRule(status.key);
    const existing = unit.statuses.find((item) => item.key === status.key);
    if (status.key === 'shield') {
      const maxShield = Math.max(1, Math.round(unit.maxSoldiers * (rule.maxValuePct || 0.3)));
      const addValue = Math.max(1, Math.round(unit.maxSoldiers * Math.max(0, status.value || rule.defaultValue)));
      const before = existing?.shieldRemaining || 0;
      const after = Math.min(maxShield, before + addValue);
      if (existing) {
        existing.shieldRemaining = after;
        existing.maxShield = maxShield;
        existing.turnsRemaining = Math.max(existing.turnsRemaining, status.turnsRemaining);
        existing.sourceSkillId = status.sourceSkillId || existing.sourceSkillId;
        existing.sourceSkillName = status.sourceSkillName || existing.sourceSkillName;
        existing.sourceSide = status.sourceSide || existing.sourceSide;
      } else {
        unit.statuses.push({
          ...status,
          stacks: 1,
          maxStacks: 1,
          shieldRemaining: after,
          maxShield,
        });
      }
      return {
        type: 'statusApplied',
        key: 'shield',
        label: rule.label,
        target: unit.side,
        targetName: unit.name,
        value: after - before,
        total: after,
        text: `[${unit.name}] 获得守御 ${after - before}（${after}）`,
        floatingText: createFloatingText(`守御 +${after - before}`, unit.side, 'shield'),
      };
    }
    if (existing) {
      existing.stacks = Math.min(existing.maxStacks || rule.maxStacks || 1, (existing.stacks || 1) + 1);
      existing.turnsRemaining = Math.max(existing.turnsRemaining || 0, status.turnsRemaining || rule.defaultTurns || 1);
      existing.value = Math.max(Number(existing.value) || 0, Number(status.value) || rule.defaultValue || 0);
      existing.sourceSkillId = status.sourceSkillId || existing.sourceSkillId;
      existing.sourceSkillName = status.sourceSkillName || existing.sourceSkillName;
      existing.sourceSide = status.sourceSide || existing.sourceSide;
    } else {
      unit.statuses.push(status);
    }
    const current = existing || status;
    return {
      type: 'statusApplied',
      key: status.key,
      label: rule.label,
      target: unit.side,
      targetName: unit.name,
      value: current.value,
      stacks: current.stacks,
      turnsRemaining: current.turnsRemaining,
      text: `[${unit.name}] 受到${rule.label}${current.stacks > 1 ? ` x${current.stacks}` : ''}`,
      floatingText: createFloatingText(rule.label, unit.side, 'status'),
    };
  }

  function tickStatusesAtActionStart(unit) {
    unit.statuses = sanitizeStatuses(unit.statuses);
    const events = [];
    unit.statuses.forEach((status) => {
      if (!status || status.key === 'shield') return;
      const rule = getStatusRule(status.key);
      if (!rule) return;
      if (status.key === 'burn' || status.key === 'poison') {
        const source = {
          soldiers: Math.max(soldierScale, unit.maxSoldiers),
          morale: 100,
          attributes: status.sourceAttributes || unit.attributes,
        };
        const multiplier = Math.max(0.05, (Number(status.value) || rule.defaultValue) * Math.max(1, toInteger(status.stacks, 1)));
        const rawDamage = calculateStatusDamage(source, unit, { damageType: rule.damageType || 'strategy', multiplier });
        const damageResult = applyDamageWithStatuses(unit, rawDamage);
        if (damageResult.dealt > 0 || damageResult.absorbed > 0) {
          events.push(...damageResult.shieldEvents);
          events.push({
            type: 'statusTick',
            key: status.key,
            label: rule.label,
            target: unit.side,
            targetName: unit.name,
            damage: damageResult.dealt,
            absorbed: damageResult.absorbed,
            soldiersAfter: unit.soldiers,
            text: `[${unit.name}] ${rule.label}造成 ${damageResult.dealt} 伤害（${unit.soldiers}）`,
            floatingText: createFloatingText(`${rule.label} -${damageResult.dealt}`, unit.side, 'damageOverTime'),
          });
        }
      }
      status.turnsRemaining = Math.max(0, toInteger(status.turnsRemaining, 0) - 1);
    });
    events.push(...removeExpiredStatuses(unit));
    return events;
  }

  return {
    applyDamage,
    applyDamageWithStatuses,
    applyStatusToUnit,
    clearDefeatedStatuses,
    clearUnitStatuses,
    consumeShield,
    healSoldiers,
    removeExpiredStatuses,
    tickStatusesAtActionStart,
  };
}

module.exports = {
  STATUS_RULES,
  createBattleStatuses,
  createFloatingText,
  getStatusLabel,
  getStatusRule,
  getStatusTotalValue,
  getStatusTurns,
  getStatusValue,
  normalizeStatus,
  normalizeStatuses,
  sanitizeStatuses,
};
