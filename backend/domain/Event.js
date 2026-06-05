const SETTLEMENT_EVENT_ID = 'evt_settlement_forest_001';
const SETTLEMENT_OPTION_ID = 'opt_collect_wood';
const REGULAR_EVENT_EXPIRATION_MS = 5 * 60 * 1000;
const THREAT_EVENT_EXPIRATION_MS = 5 * 60 * 1000;

const THREAT_EVENT_TEMPLATES = [
  {
    id: 'border_probe',
    title: '边境试探',
    description: '几名陌生猎人在边界徘徊，故意留下脚印和折断的枝条。族人们希望士兵出面，让他们明白这里已经有人守望。',
    icon: '🛡️',
    minEra: 4,
    options: [
      {
        id: 'show_patrol',
        label: '派士兵巡边',
        preview: '需要防御 2。成功获得 30 食物、8 知识；不足或超时则损失 30 食物',
        requirements: { defense: 2 },
        successEffects: [
          { type: 'resource', key: 'food', value: 30 },
          { type: 'resource', key: 'knowledge', value: 8 },
        ],
        failureEffects: [{ type: 'resource', key: 'food', value: -30 }],
      },
    ],
  },
  {
    id: 'night_fire',
    title: '夜间火光',
    description: '夜色里，远处林间升起了几簇火光。它们没有靠近，但足以让城邦里的孩子们睡不安稳。',
    icon: '🔥',
    minEra: 4,
    options: [
      {
        id: 'secure_road',
        label: '保护道路',
        preview: '需要防御 4。成功获得 25 木材、10 知识；不足或超时则损失 100 士兵、20 木材',
        requirements: { defense: 4 },
        successEffects: [
          { type: 'resource', key: 'wood', value: 25 },
          { type: 'resource', key: 'knowledge', value: 10 },
        ],
        failureEffects: [
          { type: 'soldiers', value: -100 },
          { type: 'resource', key: 'wood', value: -20 },
        ],
      },
    ],
  },
  {
    id: 'bandit_ransom',
    title: '盗匪勒索',
    description: '一伙盗匪托人带来粗糙的木牌，要求城邦交出粮食。兵营里的士兵们等待命令。',
    icon: '⚔️',
    minEra: 4,
    options: [
      {
        id: 'drive_away',
        label: '驱赶盗匪',
        preview: '需要 300 士兵。成功获得 60 食物；不足或超时则损失 45 食物',
        requirements: { soldiers: 300 },
        successEffects: [{ type: 'resource', key: 'food', value: 60 }],
        failureEffects: [{ type: 'resource', key: 'food', value: -45 }],
      },
    ],
  },
];

const REGULAR_EVENT_TEMPLATES = [
  {
    id: 'harvest_sign',
    title: '丰收的预兆',
    description: '田边的麦穗比往常更饱满，族人们讨论着该把这份好运立刻收进仓里，还是用一场小小庆祝鼓舞劳作。',
    icon: '🌾',
    minEra: 2,
    options: [
      {
        id: 'store_food',
        label: '储备粮食',
        preview: '获得 40 食物',
        effects: [{ type: 'resource', key: 'food', value: 40 }],
      },
      {
        id: 'hold_festival',
        label: '小型庆祝',
        preview: '消耗 20 食物，5 分钟内食物产出 +20%',
        effects: [
          { type: 'resource', key: 'food', value: -20 },
          { type: 'buff', buffType: 'resourceMultiplier', target: 'food', value: 0.2, durationSeconds: 300, label: '丰收庆祝' },
        ],
      },
    ],
  },
  {
    id: 'lost_trader',
    title: '迷路的行商',
    description: '一支小商队在聚落外迷了路。他们愿意用随身的见闻和货物，换取一点补给。',
    icon: '🧺',
    minEra: 2,
    options: [
      {
        id: 'share_food',
        label: '提供口粮',
        preview: '消耗 30 食物，获得 12 知识',
        effects: [
          { type: 'resource', key: 'food', value: -30 },
          { type: 'resource', key: 'knowledge', value: 12 },
        ],
      },
      {
        id: 'trade_wood',
        label: '交换木料',
        preview: '消耗 10 木材，获得 50 食物',
        effects: [
          { type: 'resource', key: 'wood', value: -10 },
          { type: 'resource', key: 'food', value: 50 },
        ],
      },
    ],
  },
  {
    id: 'scholar_debate',
    title: '学者的争论',
    description: '几名学者围着火光争论记录符号的用法。给他们一点时间和补给，也许能沉淀出新的知识。',
    icon: '📚',
    minEra: 2,
    options: [
      {
        id: 'support_debate',
        label: '供应补给',
        preview: '消耗 25 食物，获得 18 知识',
        effects: [
          { type: 'resource', key: 'food', value: -25 },
          { type: 'resource', key: 'knowledge', value: 18 },
        ],
      },
      {
        id: 'quiet_study',
        label: '安排静修',
        preview: '5 分钟内知识产出 +15%',
        effects: [{ type: 'buff', buffType: 'resourceMultiplier', target: 'knowledge', value: 0.15, durationSeconds: 300, label: '静修时段' }],
      },
    ],
  },
  {
    id: 'rest_request',
    title: '族人请求休整',
    description: '连续的劳作让族人显得疲惫。短暂休整会消耗储备，但能让聚落恢复一些秩序。',
    icon: '☀️',
    minEra: 2,
    options: [
      {
        id: 'short_rest',
        label: '安排休整',
        preview: '消耗 20 食物，5 分钟内离线收益效率 +10%',
        effects: [
          { type: 'resource', key: 'food', value: -20 },
          { type: 'buff', buffType: 'offlineEfficiencyBonus', value: 0.1, durationSeconds: 300, label: '充分休整' },
        ],
      },
      {
        id: 'keep_working',
        label: '维持节奏',
        preview: '获得 20 食物',
        effects: [{ type: 'resource', key: 'food', value: 20 }],
      },
    ],
  },
  {
    id: 'old_house_repair',
    title: '旧屋修缮',
    description: '几间旧屋需要修补。拆下来的旧料还能使用，但修好屋顶能让族人安心。',
    icon: '🏠',
    minEra: 2,
    options: [
      {
        id: 'salvage',
        label: '回收旧料',
        preview: '获得 18 木材',
        effects: [{ type: 'resource', key: 'wood', value: 18 }],
      },
      {
        id: 'repair',
        label: '修好屋顶',
        preview: '消耗 15 木材，5 分钟内幸福度 +5',
        effects: [
          { type: 'resource', key: 'wood', value: -15 },
          { type: 'buff', buffType: 'happinessFlat', value: 5, durationSeconds: 300, label: '屋顶修缮' },
        ],
      },
    ],
  },
  {
    id: 'hunter_message',
    title: '猎人带回消息',
    description: '猎人发现了一条新的兽径。直接跟随能带回肉食，仔细记录路线则需要一些知识准备。',
    icon: '🦌',
    minEra: 2,
    options: [
      {
        id: 'bring_meat',
        label: '带回肉食',
        preview: '获得 35 食物',
        effects: [{ type: 'resource', key: 'food', value: 35 }],
      },
      {
        id: 'study_trail',
        label: '研究兽径',
        preview: '消耗 8 知识，获得 70 食物',
        effects: [
          { type: 'resource', key: 'knowledge', value: -8 },
          { type: 'resource', key: 'food', value: 70 },
        ],
      },
    ],
  },
];

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
        reward: { food: 50, wood: 20 },
        action: 'claim',
      },
    ],
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };
}

function createRegularEvent(template, now = new Date(), sequence = 0) {
  const createdAt = now.toISOString();
  return {
    id: `evt_regular_${template.id}_${now.getTime()}_${sequence}`,
    type: 'regular',
    status: 'pending',
    templateId: template.id,
    title: template.title,
    description: template.description,
    icon: template.icon,
    options: template.options.map((option) => ({ ...option })),
    expiresAt: new Date(now.getTime() + REGULAR_EVENT_EXPIRATION_MS).toISOString(),
    createdAt,
  };
}

function createThreatEvent(template, now = new Date(), sequence = 0) {
  const createdAt = now.toISOString();
  return {
    id: `evt_threat_${template.id}_${now.getTime()}_${sequence}`,
    type: 'threat',
    status: 'pending',
    templateId: template.id,
    title: template.title,
    description: template.description,
    icon: template.icon,
    options: template.options.map((option) => ({ ...option })),
    expiresAt: new Date(now.getTime() + THREAT_EVENT_EXPIRATION_MS).toISOString(),
    createdAt,
  };
}

function findEvent(eventQueue, eventId) {
  return (eventQueue || []).find((event) => event.id === eventId) || null;
}

module.exports = {
  SETTLEMENT_EVENT_ID,
  SETTLEMENT_OPTION_ID,
  REGULAR_EVENT_EXPIRATION_MS,
  THREAT_EVENT_EXPIRATION_MS,
  THREAT_EVENT_TEMPLATES,
  REGULAR_EVENT_TEMPLATES,
  createSettlementEvent,
  createRegularEvent,
  createThreatEvent,
  findEvent,
};
