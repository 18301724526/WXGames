const EventDomain = require('../domain/Event');
const EventRewardCalculator = require('../calculators/EventRewardCalculator');

const REGULAR_EVENT_INTERVAL_MS = 4 * 60 * 1000;
const REGULAR_EVENT_QUEUE_LIMIT = 3;
const RECENT_TEMPLATE_LIMIT = 3;
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

function cleanupRuntimeState(gameState, now = new Date()) {
  gameState.regularEventState = normalizeRegularEventState(gameState.regularEventState, now);
  gameState.activeBuffs = normalizeActiveBuffs(gameState.activeBuffs, now);
  return gameState;
}

function countRegularEvents(gameState) {
  return (gameState.eventQueue || []).filter((event) => event.type === 'regular' && event.status !== 'claimed').length;
}

function selectTemplate(gameState) {
  const state = normalizeRegularEventState(gameState.regularEventState);
  const available = EventDomain.REGULAR_EVENT_TEMPLATES.filter((template) => (gameState.currentEra || 0) >= template.minEra);
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

function summarizeEffects(effects, reward) {
  const parts = [];
  (effects || []).forEach((effect) => {
    if (effect.type === 'resource' && effect.value < 0) {
      const label = { food: '食物', knowledge: '知识', wood: '木材' }[effect.key] || effect.key;
      parts.push(`消耗 ${Math.abs(effect.value)} ${label}`);
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
  });
}

function claimEvent(gameState, eventId, optionId) {
  const now = new Date();
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

  const validation = validateResourceEffects(gameState, option.effects || []);
  if (!validation.success) return validation;

  const reward = EventRewardCalculator.calculateReward(option);
  if (option.effects) applyEffects(gameState, event, option, now);
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
    resultSummary: summarizeEffects(option.effects || [], reward),
  };
  queue.splice(index, 1);
  gameState.eventQueue = queue;
  gameState.eventHistory = [claimedEvent, ...(gameState.eventHistory || [])].slice(0, 20);

  return {
    success: true,
    message: claimedEvent.resultSummary,
    reward,
    effects: option.effects || [],
    event: claimedEvent,
  };
}

module.exports = {
  SETTLEMENT_EVENT_ID: EventDomain.SETTLEMENT_EVENT_ID,
  SETTLEMENT_OPTION_ID: EventDomain.SETTLEMENT_OPTION_ID,
  REGULAR_EVENT_INTERVAL_MS,
  REGULAR_EVENT_QUEUE_LIMIT,
  normalizeRegularEventState,
  normalizeActiveBuffs,
  cleanupRuntimeState,
  maybeGenerateRegularEvent,
  scheduleNextRegularEvent,
  generateSpecialEvent,
  claimEvent,
};
