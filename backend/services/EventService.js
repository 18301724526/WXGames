const EventDomain = require('../domain/Event');
const EventRewardCalculator = require('../calculators/EventRewardCalculator');
const MilitaryService = require('./MilitaryService');
const BuildingEffectCalculator = require('../calculators/BuildingEffectCalculator');

const REGULAR_EVENT_INTERVAL_MS = 4 * 60 * 1000;
const THREAT_EVENT_INTERVAL_MS = 6 * 60 * 1000;
const REGULAR_EVENT_QUEUE_LIMIT = 3;
const THREAT_EVENT_QUEUE_LIMIT = 2;
const RECENT_TEMPLATE_LIMIT = 3;
const RECENT_THREAT_TEMPLATE_LIMIT = 2;
const RESOURCE_KEYS = new Set(['food', 'knowledge', 'wood']);
const BUFF_TYPES = new Set(['resourceMultiplier', 'offlineEfficiencyBonus', 'happinessFlat']);

function hasPendingEvent(gameState, eventId) {
  return (gameState.eventQueue || []).some((event) => event.id === eventId && event.status !== 'claimed');
}

function isRegularEventEnabled(gameState) {
  const tutorial = gameState?.tutorial || {};
  return gameState?.currentEra >= 2 && Boolean(tutorial.completed || tutorial.phaseCompleted?.era2);
}

function normalizeRegularEventState(state, now = new Date()) {
  const raw = state && typeof state === 'object' ? state : {};
  const nextAt = raw.nextAt || new Date(now.getTime() + REGULAR_EVENT_INTERVAL_MS).toISOString();
  return {
    nextAt,
    lastGeneratedAt: raw.lastGeneratedAt || null,
    generatedCount: Number.isFinite(raw.generatedCount) ? raw.generatedCount : 0,
    recentTemplateIds: Array.isArray(raw.recentTemplateIds) ? raw.recentTemplateIds.slice(0, RECENT_TEMPLATE_LIMIT) : [],
  };
}

function normalizeThreatEventState(state, now = new Date()) {
  const raw = state && typeof state === 'object' ? state : {};
  const nextAt = raw.nextAt || new Date(now.getTime() + THREAT_EVENT_INTERVAL_MS).toISOString();
  return {
    nextAt,
    lastGeneratedAt: raw.lastGeneratedAt || null,
    generatedCount: Number.isFinite(raw.generatedCount) ? raw.generatedCount : 0,
    recentTemplateIds: Array.isArray(raw.recentTemplateIds) ? raw.recentTemplateIds.slice(0, RECENT_THREAT_TEMPLATE_LIMIT) : [],
  };
}

function normalizeActiveBuffs(activeBuffs, now = new Date()) {
  const nowMs = now.getTime();
  return (activeBuffs || []).filter((buff) => {
    if (!buff || typeof buff !== 'object') return false;
    if (!BUFF_TYPES.has(buff.type)) return false;
    if (!Number.isFinite(buff.value)) return false;
    if (!buff.expiresAt) return true;
    return new Date(buff.expiresAt).getTime() > nowMs;
  });
}

function getTimeoutOptionEffects(option) {
  if (!option || typeof option !== 'object') return { effects: [], outcome: 'failure' };
  if (Array.isArray(option.timeoutEffects)) return { effects: option.timeoutEffects, outcome: 'failure' };
  if (option.requirements) return { effects: option.failureEffects || [], outcome: 'failure' };
  return { effects: option.effects || [], outcome: null };
}

function scoreTimeoutEffects(effects) {
  return (effects || []).reduce((score, effect) => {
    if (effect.type === 'soldiers') {
      if (effect.value < 0) return score + (Math.abs(effect.value) * 100);
      if (effect.value > 0) return score - (effect.value * 50);
    }
    if (effect.type === 'resource') {
      if (effect.value < 0) return score + Math.abs(effect.value);
      if (effect.value > 0) return score - effect.value;
    }
    if (effect.type === 'buff') {
      return score - 25;
    }
    return score;
  }, 0);
}

function getWorstThreatOption(event) {
  const options = Array.isArray(event?.options) ? event.options : [];
  if (!options.length) return null;
  if (event?.timeoutOptionId) {
    const matched = options.find((option) => option.id === event.timeoutOptionId);
    if (matched) return matched;
  }
  return options.reduce((worst, option) => {
    if (!worst) return option;
    const worstScore = scoreTimeoutEffects(getTimeoutOptionEffects(worst).effects);
    const nextScore = scoreTimeoutEffects(getTimeoutOptionEffects(option).effects);
    return nextScore > worstScore ? option : worst;
  }, null);
}

function resolveExpiredThreatEvents(gameState, now = new Date()) {
  const nowMs = now.getTime();
  const nextQueue = [];
  (gameState.eventQueue || []).forEach((event) => {
    const expiresAtMs = new Date(event?.expiresAt).getTime();
    const isExpiredThreat = event?.type === 'threat'
      && event?.status !== 'claimed'
      && event?.status !== 'expired'
      && Number.isFinite(expiresAtMs)
      && expiresAtMs <= nowMs;
    if (!isExpiredThreat) {
      nextQueue.push(event);
      return;
    }

    const worstOption = getWorstThreatOption(event);
    const optionResult = getTimeoutOptionEffects(worstOption);
    const reward = EventRewardCalculator.calculateReward({ ...worstOption, effects: optionResult.effects });
    if (worstOption) {
      applyEffects(gameState, event, { ...worstOption, effects: optionResult.effects }, now);
    }
    const expiredEvent = {
      ...event,
      status: 'expired',
      claimedAt: now.toISOString(),
      expiredAt: now.toISOString(),
      selectedOptionId: worstOption?.id || null,
      resultSummary: summarizeEffects(optionResult.effects, reward, 'timeout'),
      outcome: 'timeout',
    };
    gameState.eventHistory = [expiredEvent, ...(gameState.eventHistory || [])].slice(0, 20);
  });
  gameState.eventQueue = nextQueue;
}

function resolveExpiredRegularEvents(gameState, now = new Date()) {
  const nowMs = now.getTime();
  const nextQueue = [];
  (gameState.eventQueue || []).forEach((event) => {
    const expiresAtMs = new Date(event?.expiresAt).getTime();
    const isExpiredRegular = event?.type === 'regular'
      && event?.status !== 'claimed'
      && event?.status !== 'expired'
      && Number.isFinite(expiresAtMs)
      && expiresAtMs <= nowMs;
    if (!isExpiredRegular) {
      nextQueue.push(event);
      return;
    }

    const expiredEvent = {
      ...event,
      status: 'expired',
      claimedAt: now.toISOString(),
      expiredAt: now.toISOString(),
      selectedOptionId: null,
      resultSummary: '错过了处理时机',
      outcome: 'timeout',
    };
    gameState.eventHistory = [expiredEvent, ...(gameState.eventHistory || [])].slice(0, 20);
  });
  gameState.eventQueue = nextQueue;
}

function cleanupRuntimeState(gameState, now = new Date()) {
  gameState.regularEventState = normalizeRegularEventState(gameState.regularEventState, now);
  gameState.threatEventState = normalizeThreatEventState(gameState.threatEventState, now);
  gameState.activeBuffs = normalizeActiveBuffs(gameState.activeBuffs, now);
  resolveExpiredRegularEvents(gameState, now);
  resolveExpiredThreatEvents(gameState, now);
  return gameState;
}

function countRegularEvents(gameState) {
  return (gameState.eventQueue || []).filter((event) => event.type === 'regular' && event.status !== 'claimed').length;
}

function countThreatEvents(gameState) {
  return (gameState.eventQueue || []).filter((event) => event.type === 'threat' && event.status !== 'claimed').length;
}

function selectTemplate(gameState) {
  const state = normalizeRegularEventState(gameState.regularEventState);
  const available = EventDomain.REGULAR_EVENT_TEMPLATES.filter((template) => (gameState.currentEra || 0) >= template.minEra);
  if (!available.length) return null;
  const fresh = available.filter((template) => !state.recentTemplateIds.includes(template.id));
  const pool = fresh.length ? fresh : available;
  return pool[state.generatedCount % pool.length];
}

function selectThreatTemplate(gameState) {
  const state = normalizeThreatEventState(gameState.threatEventState);
  const available = EventDomain.THREAT_EVENT_TEMPLATES.filter((template) => (gameState.currentEra || 0) >= template.minEra);
  if (!available.length) return null;
  const fresh = available.filter((template) => !state.recentTemplateIds.includes(template.id));
  const pool = fresh.length ? fresh : available;
  return pool[state.generatedCount % pool.length];
}

function scheduleNextRegularEvent(gameState, now = new Date()) {
  const state = normalizeRegularEventState(gameState.regularEventState, now);
  gameState.regularEventState = {
    ...state,
    nextAt: new Date(now.getTime() + REGULAR_EVENT_INTERVAL_MS).toISOString(),
  };
}

function maybeGenerateRegularEvent(gameState, now = new Date()) {
  cleanupRuntimeState(gameState, now);
  if (!isRegularEventEnabled(gameState)) return null;
  if (countRegularEvents(gameState) >= REGULAR_EVENT_QUEUE_LIMIT) return null;

  const state = gameState.regularEventState;
  if (new Date(state.nextAt).getTime() > now.getTime()) return null;

  const template = selectTemplate(gameState);
  if (!template) return null;

  const event = EventDomain.createRegularEvent(template, now, state.generatedCount);
  gameState.eventQueue = [...(gameState.eventQueue || []), event];
  gameState.regularEventState = {
    nextAt: new Date(now.getTime() + REGULAR_EVENT_INTERVAL_MS).toISOString(),
    lastGeneratedAt: now.toISOString(),
    generatedCount: state.generatedCount + 1,
    recentTemplateIds: [template.id, ...state.recentTemplateIds.filter((id) => id !== template.id)].slice(0, RECENT_TEMPLATE_LIMIT),
  };
  return event;
}

function maybeGenerateThreatEvent(gameState, now = new Date()) {
  cleanupRuntimeState(gameState, now);
  if ((gameState.currentEra || 0) < 4) return null;
  if (countThreatEvents(gameState) >= THREAT_EVENT_QUEUE_LIMIT) return null;

  const state = gameState.threatEventState;
  if (new Date(state.nextAt).getTime() > now.getTime()) return null;

  const template = selectThreatTemplate(gameState);
  if (!template) return null;

  const event = EventDomain.createThreatEvent(template, now, state.generatedCount);
  gameState.eventQueue = [...(gameState.eventQueue || []), event];
  gameState.threatEventState = {
    nextAt: new Date(now.getTime() + THREAT_EVENT_INTERVAL_MS).toISOString(),
    lastGeneratedAt: now.toISOString(),
    generatedCount: state.generatedCount + 1,
    recentTemplateIds: [template.id, ...state.recentTemplateIds.filter((id) => id !== template.id)].slice(0, RECENT_THREAT_TEMPLATE_LIMIT),
  };
  return event;
}

function generateSpecialEvent(gameState, toEra) {
  if (toEra !== 2 || hasPendingEvent(gameState, EventDomain.SETTLEMENT_EVENT_ID)) {
    return null;
  }
  const event = EventDomain.createSettlementEvent();
  gameState.eventQueue = [...(gameState.eventQueue || []), event];
  return event;
}

function validateResourceEffects(gameState, effects) {
  for (const effect of effects || []) {
    if (effect.type !== 'resource' || effect.value >= 0) continue;
    if (!RESOURCE_KEYS.has(effect.key)) return { success: false, error: 'INVALID_EFFECT', message: '事件效果无效' };
    if ((gameState.resources?.[effect.key] || 0) < Math.abs(effect.value)) {
      return { success: false, error: 'INSUFFICIENT_RESOURCES', message: '资源不足，无法选择该事件选项' };
    }
  }
  return { success: true };
}

function validateEffects(gameState, effects, options = {}) {
  if (!options.allowPenaltyClamp) {
    const resourceValidation = validateResourceEffects(gameState, effects);
    if (!resourceValidation.success) return resourceValidation;
  }
  for (const effect of effects || []) {
    if (effect.type !== 'soldiers' || effect.value >= 0) continue;
    if (options.allowPenaltyClamp) continue;
    if ((gameState.military?.soldiers || 0) < Math.abs(effect.value)) {
      return { success: false, error: 'INSUFFICIENT_SOLDIERS', message: '士兵不足，无法选择该事件选项' };
    }
  }
  return { success: true };
}

function summarizeEffects(effects, reward, outcome = null) {
  const parts = [];
  if (outcome === 'success') parts.push('应对成功');
  if (outcome === 'failure') parts.push('应对受挫');
  if (outcome === 'timeout') parts.push('未及时处理，局势恶化');
  (effects || []).forEach((effect) => {
    if (effect.type === 'resource' && effect.value < 0) {
      const label = { food: '食物', knowledge: '知识', wood: '木材' }[effect.key] || effect.key;
      parts.push(`消耗 ${Math.abs(effect.value)} ${label}`);
    }
    if (effect.type === 'soldiers' && effect.value < 0) {
      parts.push(`损失 ${Math.abs(effect.value)} 士兵`);
    }
    if (effect.type === 'soldiers' && effect.value > 0) {
      parts.push(`获得 ${effect.value} 士兵`);
    }
    if (effect.type === 'buff') {
      parts.push(effect.label ? `获得 ${effect.label}` : '获得临时加成');
    }
  });
  Object.entries(reward || {}).forEach(([key, value]) => {
    const label = { food: '食物', knowledge: '知识', wood: '木材' }[key] || key;
    parts.push(`获得 ${value} ${label}`);
  });
  return parts.length ? parts.join('，') : '事件已完成';
}

function createBuff(event, effect, now = new Date()) {
  const expiresAt = new Date(now.getTime() + (effect.durationSeconds || 0) * 1000).toISOString();
  return {
    id: `buff_${event.id}_${effect.buffType}_${effect.target || 'global'}`,
    sourceEventId: event.id,
    type: effect.buffType,
    target: effect.target || null,
    value: effect.value,
    expiresAt,
    label: effect.label || event.title,
  };
}

function applyEffects(gameState, event, option, now = new Date()) {
  const effects = option.effects || [];
  gameState.resources = gameState.resources || {};
  effects.forEach((effect) => {
    if (effect.type === 'resource' && RESOURCE_KEYS.has(effect.key)) {
      gameState.resources[effect.key] = Math.max(0, (gameState.resources[effect.key] || 0) + effect.value);
    }
    if (effect.type === 'buff' && BUFF_TYPES.has(effect.buffType)) {
      gameState.activeBuffs = [...(gameState.activeBuffs || []), createBuff(event, effect, now)];
    }
    if (effect.type === 'soldiers') {
      const current = gameState.military?.soldiers || 0;
      gameState.military = MilitaryService.normalizeMilitaryState({
        ...(gameState.military || {}),
        soldiers: Math.max(0, current + effect.value),
      }, gameState);
    }
  });
}

function meetsRequirements(gameState, requirements = {}) {
  const military = MilitaryService.normalizeMilitaryState(gameState.military, gameState);
  const buildingEffects = BuildingEffectCalculator.calculate(gameState.buildings || {});
  const threatDefense = Math.max(0, buildingEffects.threatDefense || 0);
  const totalDefense = (military.defense || 0) + threatDefense;
  if (Number.isFinite(requirements.defense) && totalDefense < requirements.defense) return false;
  if (Number.isFinite(requirements.soldiers) && military.soldiers < requirements.soldiers) return false;
  return true;
}

function getOptionEffects(gameState, option) {
  if (!option.requirements) return { effects: option.effects || [], outcome: null };
  const success = meetsRequirements(gameState, option.requirements);
  return {
    effects: success ? option.successEffects || [] : option.failureEffects || [],
    outcome: success ? 'success' : 'failure',
  };
}

function claimEvent(gameState, eventId, optionId, now = new Date()) {
  cleanupRuntimeState(gameState, now);
  const queue = [...(gameState.eventQueue || [])];
  const index = queue.findIndex((event) => event.id === eventId);
  if (index < 0) {
    return { success: false, error: 'EVENT_NOT_FOUND', message: '事件不存在或已完成' };
  }

  const event = queue[index];
  const option = (event.options || []).find((item) => item.id === optionId);
  if (!option) {
    return { success: false, error: 'OPTION_NOT_FOUND', message: '事件选项不存在' };
  }

  const optionResult = getOptionEffects(gameState, option);
  const validation = validateEffects(gameState, optionResult.effects, { allowPenaltyClamp: optionResult.outcome === 'failure' });
  if (!validation.success) return validation;

  const reward = EventRewardCalculator.calculateReward({ ...option, effects: optionResult.effects });
  if (option.effects || option.requirements) applyEffects(gameState, event, { ...option, effects: optionResult.effects }, now);
  else {
    Object.entries(reward).forEach(([key, value]) => {
      gameState.resources[key] = (gameState.resources[key] || 0) + value;
    });
  }

  const claimedEvent = {
    ...event,
    status: 'claimed',
    claimedAt: now.toISOString(),
    selectedOptionId: optionId,
    resultSummary: summarizeEffects(optionResult.effects, reward, optionResult.outcome),
    outcome: optionResult.outcome,
  };
  queue.splice(index, 1);
  gameState.eventQueue = queue;
  gameState.eventHistory = [claimedEvent, ...(gameState.eventHistory || [])].slice(0, 20);

  return {
    success: true,
    message: claimedEvent.resultSummary,
    reward,
    effects: optionResult.effects,
    event: claimedEvent,
  };
}

module.exports = {
  SETTLEMENT_EVENT_ID: EventDomain.SETTLEMENT_EVENT_ID,
  SETTLEMENT_OPTION_ID: EventDomain.SETTLEMENT_OPTION_ID,
  REGULAR_EVENT_INTERVAL_MS,
  THREAT_EVENT_INTERVAL_MS,
  REGULAR_EVENT_QUEUE_LIMIT,
  THREAT_EVENT_QUEUE_LIMIT,
  normalizeRegularEventState,
  normalizeThreatEventState,
  normalizeActiveBuffs,
  resolveExpiredRegularEvents,
  resolveExpiredThreatEvents,
  cleanupRuntimeState,
  maybeGenerateRegularEvent,
  maybeGenerateThreatEvent,
  scheduleNextRegularEvent,
  generateSpecialEvent,
  claimEvent,
};
