const SETTLEMENT_EVENT_ID = 'evt_settlement_forest_001';
const SETTLEMENT_OPTION_ID = 'opt_collect_wood';

function createSettlementEvent() {
  return {
    id: SETTLEMENT_EVENT_ID,
    type: 'special',
    status: 'pending',
    title: '森林低语',
    description: '聚落的猎人在北边的森林边缘发现了一片从未涉足的林地。高大的橡树和笔直的松木排列如墙，阳光从树冠缝隙洒下，照亮了满地掉落的干燥枯枝。',
    icon: '🌲',
    options: [
      {
        id: SETTLEMENT_OPTION_ID,
        label: '收集木材',
        reward: { wood: 20 },
        action: 'claim',
      },
    ],
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };
}

function findEvent(eventQueue, eventId) {
  return (eventQueue || []).find((event) => event.id === eventId) || null;
}

module.exports = {
  SETTLEMENT_EVENT_ID,
  SETTLEMENT_OPTION_ID,
  createSettlementEvent,
  findEvent,
};
