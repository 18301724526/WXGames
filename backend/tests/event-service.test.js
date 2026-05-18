const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const EventService = require('../services/EventService');
const EventDomain = require('../domain/Event');

test('进入聚落时代会生成森林低语事件，领取后发放木材并移除事件', () => {
  const state = gameStateService.createInitialGameState('event-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 2;

  const created = EventService.generateSpecialEvent(state, 2);
  assert.equal(created.id, EventService.SETTLEMENT_EVENT_ID);
  assert.equal(state.eventQueue.length, 1);

  const result = EventService.claimEvent(state, EventService.SETTLEMENT_EVENT_ID, EventService.SETTLEMENT_OPTION_ID, now);
  assert.equal(result.success, true);
  assert.equal(result.reward.wood, 20);
  assert.equal(state.resources.wood, 20);
  assert.equal(state.eventQueue.length, 0);
  assert.equal(state.eventHistory[0].status, 'claimed');
});

test('常规事件只在聚落教程闭环完成后按时间生成', () => {
  const state = gameStateService.createInitialGameState('regular-event-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 2;
  state.tutorial = { completed: false, currentStep: 12, phaseCompleted: { newbie: true, era2: false } };
  state.regularEventState = EventService.normalizeRegularEventState({ nextAt: now.toISOString() }, now);

  const blocked = EventService.maybeGenerateRegularEvent(state, now);
  assert.equal(blocked, null);
  assert.equal(state.eventQueue.length, 0);

  state.tutorial.phaseCompleted.era2 = true;
  const created = EventService.maybeGenerateRegularEvent(state, now);
  assert.equal(created.type, 'regular');
  assert.equal(state.eventQueue.length, 1);
  assert.equal(state.regularEventState.generatedCount, 1);
});

test('常规事件队列满 3 个后不再生成', () => {
  const state = gameStateService.createInitialGameState('regular-event-cap-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 2;
  state.tutorial = { completed: true, currentStep: 15, phaseCompleted: { newbie: true, era2: true } };
  state.eventQueue = [
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[0], now, 0),
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[1], now, 1),
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[2], now, 2),
  ];
  state.regularEventState = EventService.normalizeRegularEventState({ nextAt: now.toISOString() }, now);

  const created = EventService.maybeGenerateRegularEvent(state, now);

  assert.equal(created, null);
  assert.equal(state.eventQueue.length, 3);
});

test('特殊事件不计入常规事件 3 条上限', () => {
  const state = gameStateService.createInitialGameState('regular-event-special-cap-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 2;
  state.tutorial = { completed: true, currentStep: 15, phaseCompleted: { newbie: true, era2: true } };
  state.eventQueue = [
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[0], now, 0),
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[1], now, 1),
    EventDomain.createSettlementEvent(),
  ];
  state.regularEventState = EventService.normalizeRegularEventState({ nextAt: now.toISOString() }, now);

  const created = EventService.maybeGenerateRegularEvent(state, now);

  assert.equal(created.type, 'regular');
  assert.equal(state.eventQueue.filter((event) => event.type === 'regular').length, 3);
  assert.equal(state.eventQueue.filter((event) => event.type === 'special').length, 1);
});

test('常规事件满 3 条时特殊事件仍然可以生成', () => {
  const state = gameStateService.createInitialGameState('special-event-regular-cap-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 2;
  state.eventQueue = [
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[0], now, 0),
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[1], now, 1),
    EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES[2], now, 2),
  ];

  const created = EventService.generateSpecialEvent(state, 2);

  assert.equal(created.type, 'special');
  assert.equal(state.eventQueue.length, 4);
  assert.equal(state.eventQueue.filter((event) => event.type === 'regular').length, 3);
});

test('事件选项资源不足时不会扣减或完成事件', () => {
  const state = gameStateService.createInitialGameState('regular-event-cost-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  const event = EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES.find((item) => item.id === 'lost_trader'), now, 0);
  state.currentEra = 2;
  state.resources.wood = 0;
  state.eventQueue = [event];

  const result = EventService.claimEvent(state, event.id, 'trade_wood', now);

  assert.equal(result.success, false);
  assert.equal(result.error, 'INSUFFICIENT_RESOURCES');
  assert.equal(state.eventQueue.length, 1);
  assert.equal(state.resources.food, 100);
});

test('事件选项会应用资源变化和限时 buff', () => {
  const state = gameStateService.createInitialGameState('regular-event-buff-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  const event = EventDomain.createRegularEvent(EventDomain.REGULAR_EVENT_TEMPLATES.find((item) => item.id === 'harvest_sign'), now, 0);
  state.currentEra = 2;
  state.resources.food = 100;
  state.eventQueue = [event];

  const result = EventService.claimEvent(state, event.id, 'hold_festival', now);

  assert.equal(result.success, true);
  assert.equal(state.resources.food, 80);
  assert.equal(state.activeBuffs.length, 1);
  assert.equal(state.activeBuffs[0].type, 'resourceMultiplier');
  assert.equal(state.activeBuffs[0].target, 'food');
  assert.equal(state.eventQueue.length, 0);
  assert.equal(state.eventHistory[0].selectedOptionId, 'hold_festival');
  assert.match(state.eventHistory[0].resultSummary, /丰收庆祝/);
});

test('过期 buff 会被清理', () => {
  const state = gameStateService.createInitialGameState('regular-event-expired-buff-player');
  state.activeBuffs = [
    {
      id: 'buff-expired',
      type: 'resourceMultiplier',
      target: 'food',
      value: 0.2,
      expiresAt: '2026-05-17T07:59:59.000Z',
    },
    {
      id: 'buff-active',
      type: 'resourceMultiplier',
      target: 'food',
      value: 0.2,
      expiresAt: '2026-05-17T08:05:00.000Z',
    },
  ];

  EventService.cleanupRuntimeState(state, new Date('2026-05-17T08:00:00.000Z'));

  assert.deepEqual(state.activeBuffs.map((buff) => buff.id), ['buff-active']);
});

test('威胁事件只在边境时代后按独立节奏生成', () => {
  const state = gameStateService.createInitialGameState('threat-event-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 3;
  state.threatEventState = EventService.normalizeThreatEventState({ nextAt: now.toISOString() }, now);

  const blocked = EventService.maybeGenerateThreatEvent(state, now);
  assert.equal(blocked, null);

  state.currentEra = 4;
  const created = EventService.maybeGenerateThreatEvent(state, now);

  assert.equal(created.type, 'threat');
  assert.equal(state.eventQueue.length, 1);
  assert.equal(state.threatEventState.generatedCount, 1);
});

test('新生成的威胁事件只有一个处理选项且带 5 分钟时限', () => {
  const state = gameStateService.createInitialGameState('threat-event-shape-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 4;
  state.threatEventState = EventService.normalizeThreatEventState({ nextAt: now.toISOString() }, now);

  const created = EventService.maybeGenerateThreatEvent(state, now);

  assert.equal(created.type, 'threat');
  assert.equal(created.options.length, 1);
  assert.equal(new Date(created.expiresAt).getTime(), now.getTime() + (5 * 60 * 1000));
});

test('威胁事件队列满 2 个后不再生成', () => {
  const state = gameStateService.createInitialGameState('threat-event-cap-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 4;
  state.eventQueue = [
    EventDomain.createThreatEvent(EventDomain.THREAT_EVENT_TEMPLATES[0], now, 0),
    EventDomain.createThreatEvent(EventDomain.THREAT_EVENT_TEMPLATES[1], now, 1),
  ];
  state.threatEventState = EventService.normalizeThreatEventState({ nextAt: now.toISOString() }, now);

  const created = EventService.maybeGenerateThreatEvent(state, now);

  assert.equal(created, null);
  assert.equal(state.eventQueue.length, 2);
});

test('威胁事件成功时按防御要求发放奖励', () => {
  const state = gameStateService.createInitialGameState('threat-event-success-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  const event = EventDomain.createThreatEvent(EventDomain.THREAT_EVENT_TEMPLATES.find((item) => item.id === 'border_probe'), now, 0);
  state.currentEra = 4;
  state.buildings.barracks = { level: 1 };
  state.military = { soldiers: 2 };
  state.eventQueue = [event];

  const result = EventService.claimEvent(state, event.id, 'show_patrol', now);

  assert.equal(result.success, true);
  assert.equal(state.resources.food, 130);
  assert.equal(state.resources.knowledge, 8);
  assert.equal(state.eventHistory[0].outcome, 'success');
  assert.match(state.eventHistory[0].resultSummary, /应对成功/);
});

test('瞭望台提供的边境防御会参与威胁事件检定', () => {
  const state = gameStateService.createInitialGameState('threat-event-watchtower-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  const event = EventDomain.createThreatEvent(EventDomain.THREAT_EVENT_TEMPLATES.find((item) => item.id === 'border_probe'), now, 0);
  state.currentEra = 4;
  state.buildings.watchtower = { level: 1 };
  state.military = { soldiers: 0 };
  state.eventQueue = [event];

  const result = EventService.claimEvent(state, event.id, 'show_patrol', now);

  assert.equal(result.success, true);
  assert.equal(state.eventHistory[0].outcome, 'success');
  assert.equal(state.resources.food, 130);
  assert.equal(state.resources.knowledge, 8);
});

test('威胁事件失败时惩罚会按 0 下限扣减并完成事件', () => {
  const state = gameStateService.createInitialGameState('threat-event-failure-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  const event = EventDomain.createThreatEvent(EventDomain.THREAT_EVENT_TEMPLATES.find((item) => item.id === 'night_fire'), now, 0);
  state.currentEra = 4;
  state.buildings.barracks = { level: 1 };
  state.military = { soldiers: 0 };
  state.resources.wood = 5;
  state.eventQueue = [event];

  const result = EventService.claimEvent(state, event.id, 'secure_road', now);

  assert.equal(result.success, true);
  assert.equal(state.resources.wood, 0);
  assert.equal(state.military.soldiers, 0);
  assert.equal(state.eventQueue.length, 0);
  assert.equal(state.eventHistory[0].outcome, 'failure');
  assert.match(state.eventHistory[0].resultSummary, /应对受挫/);
});

test('威胁事件超时后会自动按最差结果结算并移出队列', () => {
  const state = gameStateService.createInitialGameState('threat-event-timeout-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  const event = EventDomain.createThreatEvent(EventDomain.THREAT_EVENT_TEMPLATES.find((item) => item.id === 'border_probe'), now, 0);
  state.currentEra = 4;
  state.resources.food = 100;
  state.eventQueue = [event];
  gameStateService.normalizeState(state);

  EventService.cleanupRuntimeState(state, new Date('2026-05-17T08:05:00.000Z'));

  assert.equal(state.resources.food, 70);
  assert.equal(state.eventQueue.length, 0);
  assert.equal(state.eventHistory[0].status, 'expired');
  assert.equal(state.eventHistory[0].outcome, 'timeout');
  assert.match(state.eventHistory[0].resultSummary, /未及时处理/);
});

test('旧版多选威胁事件超时后会按最差选项结算', () => {
  const state = gameStateService.createInitialGameState('threat-event-legacy-timeout-player');
  const now = new Date('2026-05-17T08:00:00.000Z');
  state.currentEra = 4;
  state.resources.food = 100;
  state.eventQueue = [{
    id: 'evt_threat_legacy_bandit',
    type: 'threat',
    status: 'pending',
    templateId: 'bandit_ransom',
    title: '盗匪勒索',
    description: 'legacy',
    icon: '⚔️',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (5 * 60 * 1000)).toISOString(),
    options: [
      {
        id: 'drive_away',
        label: '驱赶盗匪',
        requirements: { soldiers: 3 },
        successEffects: [{ type: 'resource', key: 'food', value: 60 }],
        failureEffects: [{ type: 'resource', key: 'food', value: -45 }],
      },
      {
        id: 'pay_food',
        label: '交付粮食',
        effects: [{ type: 'resource', key: 'food', value: -25 }],
      },
    ],
  }];

  EventService.cleanupRuntimeState(state, new Date('2026-05-17T08:05:00.000Z'));

  assert.equal(state.resources.food, 55);
  assert.equal(state.eventQueue.length, 0);
  assert.equal(state.eventHistory[0].selectedOptionId, 'drive_away');
  assert.equal(state.eventHistory[0].outcome, 'timeout');
});
