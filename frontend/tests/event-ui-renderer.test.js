const test = require('node:test');
const assert = require('node:assert/strict');

const EventUIRenderer = require('../js/ui/EventUIRenderer');

function createClassList() {
  return {
    values: new Set(),
    add(name) { this.values.add(name); },
    remove(name) { this.values.delete(name); },
    contains(name) { return this.values.has(name); },
  };
}

function createButtonStub(dataset = {}) {
  return {
    _dataset: dataset,
    textContent: '',
    hidden: false,
    get dataset() {
      return this._dataset;
    },
  };
}

test('事件弹窗会渲染后端下发的多个选项', () => {
  const originalDocument = global.document;
  try {
    const elements = new Map([
      ['eventModal', { classList: createClassList() }],
      ['eventModalOptions', { innerHTML: '' }],
      ['btnClaimEvent', createButtonStub()],
    ]);
    global.document = {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', dataset: {}, classList: createClassList() });
        return elements.get(id);
      },
    };
    const texts = new Map();
    const renderer = new EventUIRenderer((id, value) => texts.set(id, value));

    renderer.open({
      title: '丰收的预兆',
      description: 'desc',
      options: [
        { id: 'store_food', label: '储备粮食', preview: '获得 40 食物' },
        { id: 'hold_festival', label: '小型庆祝', preview: '消耗 20 食物，5 分钟内食物产出 +20%' },
      ],
    });

    assert.equal(texts.get('eventModalReward'), '选择一种处理方式');
    assert.match(elements.get('eventModalOptions').innerHTML, /data-option-id="store_food"/);
    assert.match(elements.get('eventModalOptions').innerHTML, /小型庆祝/);
    assert.equal(elements.get('btnClaimEvent').hidden, true);
    assert.equal(elements.get('eventModal').classList.contains('show'), true);
  } finally {
    global.document = originalDocument;
  }
});

test('单选项事件保留主领取按钮用于教程高亮', () => {
  const originalDocument = global.document;
  try {
    const elements = new Map([
      ['eventModal', { classList: createClassList() }],
      ['eventModalOptions', { innerHTML: '' }],
      ['btnClaimEvent', createButtonStub()],
    ]);
    global.document = {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', dataset: {}, classList: createClassList() });
        return elements.get(id);
      },
    };
    const texts = new Map();
    const renderer = new EventUIRenderer((id, value) => texts.set(id, value));

    renderer.open({
      title: '森林低语',
      description: 'desc',
      options: [{ id: 'opt_collect_wood', label: '收集木材', reward: { wood: 20 } }],
    });

    assert.equal(texts.get('eventModalReward'), '🪵 +20');
    assert.equal(elements.get('eventModalOptions').innerHTML, '');
    assert.equal(elements.get('btnClaimEvent').hidden, false);
    assert.equal(elements.get('btnClaimEvent').dataset.optionId, 'opt_collect_wood');
    assert.equal(elements.get('btnClaimEvent').textContent, '收集木材');
  } finally {
    global.document = originalDocument;
  }
});

test('威胁事件卡片会带 threat 样式并显示倒计时单选按钮', () => {
  const originalDocument = global.document;
  const originalDateNow = Date.now;
  try {
    Date.now = () => new Date('2026-05-17T08:01:00.000Z').getTime();
    const elements = new Map([
      ['pendingEventsContainer', { innerHTML: '' }],
      ['eventsBadge', { hidden: true, textContent: '' }],
      ['eventHistoryList', { innerHTML: '' }],
      ['eventModal', { classList: createClassList() }],
      ['eventModalOptions', { innerHTML: '' }],
      ['btnClaimEvent', createButtonStub()],
    ]);
    global.document = {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', dataset: {}, classList: createClassList() });
        return elements.get(id);
      },
    };
    const renderer = new EventUIRenderer(() => {});
    const event = {
      id: 'evt_threat_border_probe',
      type: 'threat',
      title: '边境试探',
      description: 'desc',
      icon: '🛡️',
      expiresAt: '2026-05-17T08:05:00.000Z',
      options: [
        { id: 'show_patrol', label: '派士兵巡边', preview: '需要防御 2。成功获得 30 食物' },
      ],
    };

    renderer.render({
      resources: { knowledgePerSecond: 0 },
      eventQueue: [event],
      eventHistory: [],
    });
    renderer.open(event);

    assert.match(elements.get('pendingEventsContainer').innerHTML, /is-threat/);
    assert.match(elements.get('pendingEventsContainer').innerHTML, /剩余 4:00/);
    assert.equal(elements.get('eventsBadge').hidden, false);
    assert.equal(elements.get('eventsBadge').textContent, '1');
    assert.equal(elements.get('eventModalOptions').innerHTML, '');
    assert.equal(elements.get('btnClaimEvent').hidden, false);
    assert.equal(elements.get('btnClaimEvent').dataset.optionId, 'show_patrol');
    assert.match(elements.get('btnClaimEvent').textContent, /派士兵巡边/);
  } finally {
    Date.now = originalDateNow;
    global.document = originalDocument;
  }
});

test('普通事件也会显示剩余时间提示', () => {
  const originalDocument = global.document;
  const originalDateNow = Date.now;
  try {
    Date.now = () => new Date('2026-05-17T08:01:00.000Z').getTime();
    const elements = new Map([
      ['pendingEventsContainer', { innerHTML: '' }],
      ['eventsBadge', { hidden: true, textContent: '' }],
      ['eventHistoryList', { innerHTML: '' }],
      ['eventModal', { classList: createClassList() }],
      ['eventModalOptions', { innerHTML: '' }],
      ['btnClaimEvent', createButtonStub()],
    ]);
    global.document = {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', dataset: {}, classList: createClassList() });
        return elements.get(id);
      },
    };
    const texts = new Map();
    const renderer = new EventUIRenderer((id, value) => texts.set(id, value));
    const event = {
      id: 'evt_regular_harvest_sign',
      type: 'regular',
      title: '丰收的预兆',
      description: 'desc',
      icon: '🌾',
      expiresAt: '2026-05-17T08:05:00.000Z',
      options: [
        { id: 'store_food', label: '储备粮食', preview: '获得 40 食物' },
        { id: 'hold_festival', label: '小型庆祝', preview: '消耗 20 食物，5 分钟内食物产出 +20%' },
      ],
    };

    renderer.render({
      resources: { knowledgePerSecond: 0 },
      eventQueue: [event],
      eventHistory: [],
    });
    renderer.open(event);

    assert.match(elements.get('pendingEventsContainer').innerHTML, /剩余 4:00/);
    assert.match(elements.get('pendingEventsContainer').innerHTML, /超时将自动失效/);
    assert.match(texts.get('eventModalReward'), /剩余 4:00/);
  } finally {
    Date.now = originalDateNow;
    global.document = originalDocument;
  }
});
