const test = require('node:test');
const assert = require('node:assert/strict');

const UIStatePresenter = require('../js/state/UIStatePresenter');

test('auth view states format login shell and remembered credentials', () => {
  const credentials = UIStatePresenter.buildAuthCredentialViewState({
    rememberEnabled: true,
    rememberedUsername: 'test2',
    rememberedPassword: '123456',
    username: 'fallback',
  });
  assert.equal(credentials.rememberPasswordChecked, true);
  assert.equal(credentials.usernameValue, 'test2');
  assert.equal(credentials.passwordValue, '123456');

  const fallback = UIStatePresenter.buildAuthCredentialViewState({
    rememberEnabled: false,
    username: 'last-user',
    rememberedPassword: 'hidden',
  });
  assert.equal(fallback.rememberPasswordChecked, false);
  assert.equal(fallback.usernameValue, 'last-user');
  assert.equal(fallback.passwordValue, '');

  const login = UIStatePresenter.buildAuthShellViewState({ authenticated: false, message: '请登录' });
  assert.equal(login.loginPanelVisible, true);
  assert.equal(login.appVisible, false);
  assert.equal(login.message, '请登录');

  const app = UIStatePresenter.buildAuthShellViewState({ authenticated: true, message: 'ignored' });
  assert.equal(app.loginPanelVisible, false);
  assert.equal(app.appVisible, true);
  assert.equal(app.message, '');
});

test('tutorial highlight view state formats overlay bubble and pointer geometry', () => {
  const view = UIStatePresenter.buildTutorialHighlightViewState({
    top: 360,
    left: 24,
    width: 180,
    height: 52,
    bottom: 412,
  }, {
    innerWidth: 390,
    innerHeight: 844,
  });

  assert.deepEqual(view.overlay, {
    top: '352px',
    left: '16px',
    width: '196px',
    height: '68px',
  });
  assert.equal(view.bubble.top, '274px');
  assert.equal(view.bubble.left, '12px');
  assert.equal(view.pointer.top, '418px');
  assert.equal(view.pointer.left, '102px');
});

test('tab navigation view states format active tabs and tutorial locks', () => {
  const navigation = UIStatePresenter.buildTabNavigationViewState({ currentTab: 'resources' }, { requestedTab: 'territory' });
  assert.equal(navigation.activeTab, 'military');
  assert.equal(navigation.tabs.find((tab) => tab.id === 'military').isActive, true);
  assert.equal(navigation.pages.find((page) => page.id === 'military').isActive, true);

  const locks = UIStatePresenter.buildTabLockViewState([
    { id: 'resources' },
    { id: 'civilization' },
  ], (tabId) => tabId === 'resources');
  assert.deepEqual(locks, [
    { id: 'resources', disabled: false, isLocked: false },
    { id: 'civilization', disabled: true, isLocked: true },
  ]);
});

test('task center view state normalizes tabs, badges, categories, and legacy guide fallback', () => {
  const view = UIStatePresenter.buildTaskCenterViewState({
    taskCenter: {
      visible: true,
      activeTab: 'daily',
      tabs: [
        { id: 'daily', label: '每日任务', badge: 0 },
        { id: 'main', label: '主线任务', badge: 1 },
        { id: 'season', label: '赛季任务', badge: 0 },
        { id: 'challenge', label: '挑战任务', badge: 0 },
      ],
      categories: {
        daily: { tasks: [], emptyText: '暂无每日任务' },
        main: {
          tasks: [{
            id: 'barracks_supplies',
            title: '城邦守备',
            status: 'claimable',
            rewardText: '食物 +260 / 知识 +80',
          }, {
            id: 'lumbermill_supplies',
            title: '备齐伐木物资',
            status: 'completed',
            rewardText: '木材 +15 / 食物 +50',
          }],
        },
        season: { tasks: [], emptyText: '暂无赛季任务' },
        challenge: { tasks: [], emptyText: '暂无挑战任务' },
      },
      summary: { claimableCount: 1, activeCount: 1 },
    },
  }, { activeTab: 'main' });

  assert.equal(view.visible, true);
  assert.equal(view.activeTab, 'main');
  assert.equal(view.tabs.find((tab) => tab.id === 'main').isActive, true);
  assert.equal(view.tabs.find((tab) => tab.id === 'main').badge, 1);
  assert.equal(view.activeCategory.tasks[0].action.type, 'claimTaskReward');
  assert.equal(view.activeCategory.tasks[0].actionLabel, '领取');
  assert.equal(view.activeCategory.tasks[1].action, null);
  assert.equal(view.activeCategory.tasks[1].actionLabel, '已完成');
  assert.equal(view.categories.daily.emptyText, '暂无每日任务');

  const fallback = UIStatePresenter.buildTaskCenterViewState({
    guideTasks: {
      visible: true,
      tasks: [{
        id: 'lumbermill_supplies',
        title: '备齐伐木物资',
        status: 'active',
        target: 'card-lumbermill',
      }],
    },
  });

  assert.equal(fallback.visible, true);
  assert.equal(fallback.activeTab, 'main');
  assert.equal(fallback.categories.main.tasks[0].id, 'lumbermill_supplies');
  assert.equal(fallback.categories.main.tasks[0].action.type, 'goToGuideTaskTarget');
});

test('resource view state is renderer-neutral and formats resource display', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 2,
    resources: {
      food: 12.8,
      knowledge: 5.2,
      wood: 30.9,
      iron: 7.4,
      stone: 9.6,
      foodOutputPerSecond: 1.5,
      foodConsumptionPerSecond: 0.25,
      foodNetPerSecond: 1.25,
      knowledgePerSecond: 0.4,
      woodPerSecond: 0,
      ironPerSecond: 0,
      stonePerSecond: 0,
    },
    happiness: 92,
    gameDay: 7,
  });

  assert.equal(view.hasWood, true);
  assert.equal(view.hasIron, true);
  assert.equal(view.hasStone, true);
  assert.equal(view.text.foodValue, 12);
  assert.equal(view.text.knowledgeValue, 5);
  assert.equal(view.text.woodValue, 30);
  assert.equal(view.text.ironValue, 7);
  assert.equal(view.text.stoneValue, 9);
  assert.equal(view.text.foodRate, '+1.25/s');
  assert.equal(view.text.foodConsumptionRate, '-0.25/s');
  assert.equal(view.text.knowledgeRate, '+0.4/s');
  assert.equal(view.text.woodRate, '+0/s');
  assert.equal(view.text.ironRate, '+0/s');
  assert.equal(view.text.stoneRate, '+0/s');
  assert.equal(view.text.happinessValue, 92);
  assert.equal(view.classState.foodNetRate['is-positive'], true);
  assert.equal(view.classState.foodNetRate['is-negative'], false);
});

test('resource view state compacts large resource amounts', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 2,
    resources: {
      food: 1120,
      knowledge: 1200000,
      wood: 3450000000,
      iron: 6400000,
      stone: 7200,
      foodOutputPerSecond: 1250,
      foodConsumptionPerSecond: 1100,
      foodNetPerSecond: 150,
      knowledgePerSecond: 0,
      woodPerSecond: 1000000000000,
    },
  });

  assert.equal(UIStatePresenter.formatResourceAmount(999), 999);
  assert.equal(UIStatePresenter.formatResourceAmount(1000), '1k');
  assert.equal(UIStatePresenter.formatResourceAmount(1250), '1.2k');
  assert.equal(view.text.foodValue, '1.1k');
  assert.equal(view.text.knowledgeValue, '1.2M');
  assert.equal(view.text.woodValue, '3.4G');
  assert.equal(view.text.ironValue, '6.4M');
  assert.equal(view.text.stoneValue, '7.2k');
  assert.equal(view.text.foodOutputRate, '+1.2k/s');
  assert.equal(view.text.foodConsumptionRate, '-1.1k/s');
  assert.equal(view.text.woodRate, '+1T/s');
});

test('resource view state always exposes expanded resources with zero production defaults', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 1,
    resources: {
      food: 4,
      knowledge: 2,
      wood: 99,
      iron: 0,
      stone: 0,
      foodPerSecond: -0.5,
    },
  });

  assert.equal(view.hasWood, true);
  assert.equal(view.text.woodValue, 99);
  assert.equal(view.text.woodRate, '+0/s');
  assert.equal(view.text.ironValue, 0);
  assert.equal(view.text.stoneValue, 0);
  assert.equal(view.text.ironRate, '+0/s');
  assert.equal(view.text.stoneRate, '+0/s');
  assert.equal(view.classState.foodNetRate['is-positive'], false);
  assert.equal(view.classState.foodNetRate['is-negative'], true);
});

test('city switcher view state formats active city and options', () => {
  const view = UIStatePresenter.buildCitySwitcherViewState({
    activeCityId: 'capital',
    cityState: {
      activeCityId: 'capital',
      capitalCityId: 'capital',
      cities: [
        { id: 'capital', name: '北京', isCapital: true, population: { total: 8 }, totalBuildings: 4 },
        { id: 'site_river', name: '河湾城', isCapital: false, population: { total: 3 }, totalBuildings: 1 },
      ],
    },
  });

  assert.equal(view.hidden, false);
  assert.equal(view.activeCityName, '北京');
  assert.equal(view.options[0].tag, '主城');
  assert.equal(view.options[1].population, 300);
  assert.equal(view.options[1].officials, 3);
  assert.equal(view.options[1].metaText, '人口 300 · 平原 · 宜居平稳');
  assert.equal(view.options[1].isActive, false);
  assert.match(view.signature, /site_river/);
});

test('civilization view state formats era progress and advance lock text', () => {
  const locked = UIStatePresenter.buildCivilizationViewState({
    currentEra: 1,
    currentEraName: '农耕时代',
    currentEraDescription: '农耕时代：积累食物。',
    gameDay: 3,
    population: { total: 5 },
    totalBuildings: 2,
    techs: { seed: true },
    happiness: 91,
    eraProgress: {
      percentage: 100,
      canAdvance: true,
      targetEraName: '聚落时代',
      conditions: [{ name: '食物', current: 120, required: 120, met: true }],
    },
  }, { completed: false, currentStep: 8 }, { canOpenCivilizationTab: true });

  assert.equal(locked.text.eraName, '农耕时代');
  assert.equal(locked.text.civOverviewDay, '第 3 天');
  assert.equal(locked.text.civOverviewPop, 500);
  assert.equal(locked.text.civOverviewTechs, '1/0');
  assert.equal(locked.text.eraProgressText, '总进度: 100%');
  assert.equal(locked.text.advanceLabel, '引导未解锁');
  assert.equal(locked.advanceButton.disabled, true);
  assert.equal(locked.conditions[0].progressText, '120/120');

  const ready = UIStatePresenter.buildCivilizationViewState({
    currentEra: 1,
    eraProgress: { percentage: 100, canAdvance: true, conditions: [] },
  }, { completed: false, currentStep: 9 }, { canOpenCivilizationTab: true });

  assert.equal(ready.text.advanceLabel, '满足条件，可进阶');
  assert.equal(ready.advanceButton.disabled, false);
});

test('civilization view state keeps subcity era advance disabled', () => {
  const view = UIStatePresenter.buildCivilizationViewState({
    currentEra: 3,
    isCapitalCity: false,
    eraProgress: { percentage: 100, canAdvance: true, conditions: [] },
  }, { completed: true }, { canOpenCivilizationTab: true });

  assert.equal(view.text.advanceLabel, '分城跟随主城时代');
  assert.equal(view.advanceButton.disabled, true);
});

test('military navigation view state locks scout and world before classical era', () => {
  const locked = UIStatePresenter.buildMilitaryNavigationViewState({
    currentEra: 4,
    militaryView: 'world',
  });

  assert.equal(locked.activeView, 'army');
  assert.equal(locked.views.find((view) => view.id === 'army').disabled, false);
  assert.equal(locked.views.find((view) => view.id === 'scout').disabled, true);
  assert.equal(locked.views.find((view) => view.id === 'world').title, '进入古典时代后解锁');

  const unlocked = UIStatePresenter.buildMilitaryNavigationViewState({
    currentEra: 5,
    militaryView: 'world',
  });

  assert.equal(unlocked.activeView, 'world');
  assert.equal(unlocked.views.find((view) => view.id === 'world').isActive, true);
  assert.equal(unlocked.views.find((view) => view.id === 'scout').disabled, false);
});

test('advisor, naming, and recent log view states are renderer-neutral', () => {
  const advisor = UIStatePresenter.buildAdvisorViewState({
    message: '派出侦察队探索城市之外的世界。',
    target: 'tab-military',
  });
  const emptyAdvisor = UIStatePresenter.buildAdvisorViewState(null);
  const naming = UIStatePresenter.buildNamingPromptViewState({
    type: 'polity',
    title: '为势力命名',
    message: '你已经扩张了领土。',
  });
  const logs = UIStatePresenter.buildRecentLogViewState([
    { text: '第一条' },
    { text: '第二条' },
  ]);

  assert.equal(advisor.hidden, false);
  assert.equal(advisor.goButton.disabled, false);
  assert.equal(UIStatePresenter.getAdvisorTargetTab(advisor.activeAdvisor.target), 'military');
  assert.equal(UIStatePresenter.getAdvisorTargetTab('scout-action-first'), 'military');
  assert.equal(emptyAdvisor.hidden, true);
  assert.equal(emptyAdvisor.text.message, '暂无建议。');
  assert.equal(naming.placeholder, '例如：赤火联盟');
  assert.equal(naming.key, 'polity:polity');
  assert.equal(logs.isEmpty, false);
  assert.deepEqual(logs.items.map((item) => item.text), ['第一条', '第二条']);
  assert.equal(UIStatePresenter.buildRecentLogViewState([]).emptyText, '暂无日志');
});

test('request log and territory summary view states format shell text', () => {
  const requestLogs = UIStatePresenter.buildRequestLogViewState([
    { timestamp: '04:50:01', method: 'GET', path: '/game/state', statusCode: 200, duration: 12 },
    { timestamp: '04:50:02', method: 'POST', path: '/game/action', statusCode: 500, duration: 24 },
  ]);
  const territory = UIStatePresenter.buildTerritorySummaryViewState({
    polity: { name: '赤火联盟' },
    occupiedCount: 2,
    discoveredCount: 5,
  });

  assert.equal(requestLogs.isEmpty, false);
  assert.equal(requestLogs.items[0].endpoint, 'GET /game/state');
  assert.equal(requestLogs.items[0].isError, false);
  assert.equal(requestLogs.items[1].isError, true);
  assert.equal(requestLogs.items[1].durationText, '24ms');
  assert.equal(UIStatePresenter.buildRequestLogViewState([]).emptyText, '暂无请求记录');
  assert.equal(territory.text.polityName, '赤火联盟');
  assert.equal(territory.text.territoryCount, '2/5 已控制');
});

test('building view state is renderer-neutral and formats compact costs', () => {
  const view = UIStatePresenter.buildBuildingViewState({
    unlockedBuildings: ['farm'],
    resources: { food: 2000, wood: 1000000 },
    buildings: { farm: { level: 1 } },
    buildingCosts: { farm: { food: 1250, wood: 1000000 } },
    buildingEffects: {
      byBuilding: {
        farm: { foodOutputBonus: 1 },
      },
    },
  }, { completed: true, currentStep: 15 }, {
    farm: {
      id: 'farm',
      name: 'Farm',
      icon: 'F',
      maintenance: {
        perLevelPerMinute: { food: 0.4, wood: 0.1 },
        habitabilityPressure: 1,
        summary: 'Requires daily upkeep.',
      },
      scalePlan: {
        openEnded: true,
        currentCapRetained: true,
      },
      ui: {
        effectText: [{ field: 'foodOutputBonus', label: 'Food output', format: 'percent' }],
      },
    },
  });

  assert.equal(view.isEmpty, false);
  assert.equal(view.cards[0].id, 'farm');
  assert.equal(view.cards[0].levelText, '等级 1');
  assert.equal(view.cards[0].effectText, 'Food output +100%');
  assert.deepEqual(view.cards[0].planningLines, [
    '维护：食物、木材 · 宜居压力轻微',
    '规模：后续可继续扩张',
  ]);
  assert.deepEqual(view.cards[0].planningBadges, [
    { type: 'maintenance', label: '维护 食物/木材' },
    { type: 'pressure', label: '压力 轻微' },
    { type: 'scale', label: '规模 可扩张' },
  ]);
  assert.deepEqual(view.cards[0].cost.parts.map((part) => [part.resource, part.text]), [
    ['wood', '1M'],
    ['food', '1.2k'],
  ]);
  assert.equal(view.cards[0].button.action, 'upgrade');
  assert.equal(view.cards[0].button.disabled, false);
});

test('building view state disables build and upgrade actions when resources are insufficient', () => {
  const view = UIStatePresenter.buildBuildingViewState({
    unlockedBuildings: ['lumbermill'],
    resources: { food: 100, wood: 10, knowledge: 0 },
    buildings: { lumbermill: { level: 0 } },
    buildingCosts: { lumbermill: { food: 200, wood: 50 } },
  }, { completed: true, currentStep: 15 }, {
    lumbermill: {
      id: 'lumbermill',
      name: '伐木场',
      icon: 'L',
      ui: { description: '产出木材' },
    },
  });

  assert.equal(view.cards[0].button.action, 'build');
  assert.equal(view.cards[0].button.disabled, true);
  assert.equal(view.cards[0].button.label, '资源不足');
});

test('event view state is renderer-neutral and formats cards, badge, and history', () => {
  const view = UIStatePresenter.buildEventViewState({
    resources: { knowledgePerSecond: 1.25 },
    eventQueue: [
      {
        id: 'evt_regular_harvest_sign',
        type: 'regular',
        title: 'Harvest Sign',
        description: 'Choose a response.',
        icon: 'H',
        expiresAt: '2026-05-17T08:05:00.000Z',
      },
      {
        id: 'evt_threat_border_probe',
        type: 'threat',
        title: 'Border Probe',
        description: 'Respond soon.',
        expiresAt: '2026-05-17T08:06:00.000Z',
      },
    ],
    eventHistory: [
      {
        type: 'regular',
        title: 'Resolved',
        icon: 'R',
        selectedOptionId: 'gain_food',
        options: [{ id: 'gain_food', reward: { food: 1250 } }],
      },
    ],
  }, { nowMs: new Date('2026-05-17T08:01:00.000Z').getTime() });

  assert.equal(view.text, undefined);
  assert.deepEqual(view.badge, { hidden: false, text: '2' });
  assert.equal(view.pending.isEmpty, false);
  assert.equal(view.pending.cards[0].hint, '剩余 4:00，超时将自动失效');
  assert.equal(view.pending.cards[0].classState['is-special'], false);
  assert.equal(view.pending.cards[1].hint, '剩余 5:00，超时将按失败处理');
  assert.equal(view.pending.cards[1].classState['is-threat'], true);
  assert.equal(view.history.items[0].result, '食物 +1.2k');
});

test('tech view state formats knowledge rate for Canvas renderer', () => {
  const view = UIStatePresenter.buildTechViewState({
    resources: { knowledgePerSecond: 1.25 },
  });

  assert.equal(view.text.knowledgeRate, '1.25/s');
  assert.equal(view.text.title, '科技树');
  assert.equal(view.text.placeholder, '首期暂不重构科技系统');
});

test('event modal view state handles multiple and single event options', () => {
  const multi = UIStatePresenter.buildEventModalViewState({
    type: 'regular',
    title: 'Harvest Sign',
    description: 'Choose.',
    icon: 'H',
    expiresAt: '2026-05-17T08:05:00.000Z',
    options: [
      { id: 'store_food', label: 'Store food', preview: 'Gain 40 food' },
      { id: 'hold_festival', label: 'Festival', reward: { knowledge: 1200 } },
    ],
  }, { nowMs: new Date('2026-05-17T08:01:00.000Z').getTime() });

  assert.equal(multi.iconAsset, 'assets/art/icon-event-cutout.webp');
  assert.equal(multi.text.title, 'Harvest Sign');
  assert.equal(multi.text.reward, '选择一种处理方式 | 剩余 4:00，超时将自动失效');
  assert.deepEqual(multi.metaRows, [
    { label: '时限', text: '剩余 4:00，超时将自动失效', tone: 'time' },
    { label: '选项', text: '选择一种处理方式', tone: 'neutral' },
  ]);
  assert.equal(multi.options[1].preview, '知识 +1.2k');
  assert.deepEqual(multi.options[1].rows, [
    { label: '需求', text: '无', tone: 'requirement', parts: [], empty: true },
    { label: '奖励', text: '知识 +1.2k', tone: 'reward', parts: [{ type: 'resource', resource: 'knowledge', text: '+1.2k' }], empty: false },
    { label: '消耗', text: '无', tone: 'cost', parts: [], empty: true },
    { label: '惩罚', text: '无', tone: 'penalty', parts: [], empty: true },
  ]);
  assert.equal(multi.claimButton.hidden, true);

  const single = UIStatePresenter.buildEventModalViewState({
    title: 'Forest',
    options: [{ id: 'collect', label: 'Collect', reward: { wood: 20 } }],
  });

  assert.equal(single.text.reward, '木材 +20');
  assert.deepEqual(single.claimButton, { optionId: 'collect', label: 'Collect', hidden: false });
});

test('event modal view state separates requirements rewards costs penalties and time', () => {
  const view = UIStatePresenter.buildEventModalViewState({
    type: 'threat',
    title: 'Bandit Ransom',
    description: 'Choose a response before the deadline.',
    icon: 'B',
    expiresAt: '2026-05-17T08:05:00.000Z',
    options: [
      {
        id: 'drive_away',
        label: 'Drive away the bandits',
        requirements: { soldiers: 3, defense: 2 },
        successEffects: [
          { type: 'resource', key: 'food', value: 60 },
          { type: 'resource', key: 'knowledge', value: -8 },
        ],
        failureEffects: [
          { type: 'resource', key: 'food', value: -45 },
          { type: 'soldiers', value: -1 },
        ],
      },
    ],
  }, { nowMs: new Date('2026-05-17T08:01:00.000Z').getTime() });

  assert.equal(view.iconAsset, 'assets/art/icon-event-cutout.webp');
  assert.deepEqual(view.metaRows, [
    { label: '时限', text: '剩余 4:00，超时将按失败处理', tone: 'penalty' },
  ]);
  assert.deepEqual(view.options[0].rows, [
    { label: '需求', text: '防御 2，士兵 3', tone: 'requirement', parts: [{ type: 'text', text: '防御 2' }, { type: 'resource', resource: 'soldier', text: '3' }], empty: false },
    { label: '奖励', text: '食物 +60', tone: 'reward', parts: [{ type: 'resource', resource: 'food', text: '+60' }], empty: false },
    { label: '消耗', text: '知识 -8', tone: 'cost', parts: [{ type: 'resource', resource: 'knowledge', text: '-8' }], empty: false },
    { label: '惩罚', text: '食物 -45 士兵 -1', tone: 'penalty', parts: [{ type: 'resource', resource: 'food', text: '-45' }, { type: 'resource', resource: 'soldier', text: '-1' }], empty: false },
  ]);
  assert.equal(view.options[0].preview, '需求 防御 2，士兵 3；奖励 食物 +60；消耗 知识 -8；惩罚 食物 -45 士兵 -1');
});

test('military view state formats army counts and training progress', () => {
  const view = UIStatePresenter.buildMilitaryViewState({
    military: {
      soldiers: 2,
      soldierCap: 5,
      trainingProgress: 15,
      trainingIntervalSeconds: 30,
      defense: 2,
      soldiersOnMission: 1,
    },
    buildingEffects: { threatDefense: 2 },
    territoryState: { availableSoldiers: 7 },
  });

  assert.equal(view.text.soldierCount, '2/5');
  assert.equal(view.text.militaryDefense, 4);
  assert.equal(view.text.availableSoldierCount, 7);
  assert.equal(view.text.soldiersOnMission, 1);
  assert.equal(view.text.soldierTrainingText, '下一名 15/30 秒');
  assert.equal(view.training.progressWidth, '50%');
});

test('scout control view state formats directional actions and countdowns', () => {
  const view = UIStatePresenter.buildScoutControlViewState({
    currentEra: 5,
    territoryState: {
      maxActiveScouts: 1,
      directions: [
        { id: 'n', label: '北方' },
        { id: 'e', label: '东方' },
      ],
      scoutMissions: [{
        id: 'scout_n_1',
        direction: 'n',
        completesAt: '2026-05-17T08:01:00.000Z',
        status: 'active',
      }],
    },
  }, { nowMs: new Date('2026-05-17T08:00:30.000Z').getTime() });

  const north = view.cells.find((cell) => cell.id === 'n');
  const east = view.cells.find((cell) => cell.id === 'e');

  assert.equal(view.statusText, '北方侦察中，预计 0:30 后返回。');
  assert.equal(north.direction, 'n');
  assert.equal(north.status, 'active');
  assert.equal(north.actionText, '0:30');
  assert.equal(north.disabled, true);
  assert.equal(east.direction, 'e');
  assert.equal(east.status, 'locked');
  assert.equal(east.action, '');
});

test('scout controls stay empty before classical era', () => {
  const view = UIStatePresenter.buildScoutControlViewState({ currentEra: 4 });

  assert.equal(view.statusText, '进入古典时代后可派出侦察队。');
  assert.deepEqual(view.cells, []);
});

test('world radar view state places sites and exposes map signature', () => {
  const view = UIStatePresenter.buildWorldRadarViewState([
    { id: 'capital', x: 0, y: 0, visualOffset: { x: 0, y: 0 }, owner: 'player', status: 'occupied', type: 'capital', art: 'capital.png', naturalName: 'Capital' },
    { id: 'site_a', x: 4, y: 0, visualOffset: { x: 0, y: 0 }, owner: 'neutral', status: 'discovered', type: 'town', art: 'town.png', naturalName: 'Town' },
    { id: 'site_b', x: 5, y: 0, visualOffset: { x: 0, y: 0 }, owner: 'city_state', status: 'discovered', type: 'city', art: 'city.png', naturalName: 'City', cityName: 'Stone City' },
  ], { panX: 12, panY: -4 });

  const capital = view.sites.find((site) => site.id === 'capital');
  const siteA = view.sites.find((site) => site.id === 'site_a');
  const siteB = view.sites.find((site) => site.id === 'site_b');

  assert.equal(view.pan.x, 12);
  assert.equal(view.pan.y, -4);
  assert.match(view.signature, /site_b/);
  assert.equal(capital.position.left, '50.00');
  assert.equal(capital.position.top, '50.00');
  assert.equal(siteA.owner, 'neutral');
  assert.equal(siteA.status, 'discovered');
  assert.equal(siteB.name, 'Stone City');
  assert.ok(Math.hypot(Number(siteA.position.left) - Number(siteB.position.left), Number(siteA.position.top) - Number(siteB.position.top)) >= 9.5);
});

test('world site dialog view state formats details and expedition actions', () => {
  const territories = [
    {
      id: 'tribe_site',
      status: 'discovered',
      owner: 'tribe',
      occupationMode: 'conquest',
      naturalName: '山口部落',
      originDistance: 3,
      scale: 2,
      threat: 4,
      defense: 5,
      recommendedSoldiers: 5,
      effects: { foodOutputMultiplier: 0.1 },
    },
    {
      id: 'neutral_site',
      status: 'discovered',
      owner: 'neutral',
      occupationMode: 'settlement',
      naturalName: '河湾空地',
      defense: 0,
      recommendedSoldiers: 1,
    },
  ];
  const view = UIStatePresenter.buildWorldSiteDialogViewState(territories, {
    availableSoldiers: 4,
    missionDurationSeconds: 90,
  }, {
    selectedSiteId: 'tribe_site',
    expeditionConfigSiteId: 'tribe_site',
    expeditionSoldiers: '6',
  });
  const detail = view.details.find((item) => item.id === 'tribe_site');
  const neutral = view.details.find((item) => item.id === 'neutral_site');

  assert.equal(view.showModal, true);
  assert.equal(detail.visible, true);
  assert.equal(neutral.visible, false);
  assert.equal(detail.text.status, '已发现');
  assert.equal(detail.text.owner, '有主 · 部落');
  assert.equal(detail.text.summary, '食物 +10%');
  assert.equal(detail.text.march, '行军耗时 1:30');
  assert.equal(detail.action.kind, 'group');
  assert.equal(detail.action.buttons[2].action, 'open-expedition');
  assert.equal(detail.action.expeditionConfig.fields.soldiers.value, 6);
  assert.equal(detail.action.expeditionConfig.disabled, true);
});

test('world site dialog view state formats occupied and contested actions', () => {
  const view = UIStatePresenter.buildWorldSiteDialogViewState([
    {
      id: 'occupied_site',
      status: 'occupied',
      owner: 'player',
      naturalName: '河口城',
      lastBattle: { mode: 'conquest', success: false, casualties: 2 },
    },
    {
      id: 'ready_site',
      status: 'contested',
      owner: 'tribe',
      naturalName: '岗哨',
      mission: { status: 'ready', durationSeconds: 120 },
    },
  ], {}, { selectedSiteId: 'occupied_site' });
  const occupied = view.details.find((item) => item.id === 'occupied_site');
  const ready = view.details.find((item) => item.id === 'ready_site');

  assert.equal(occupied.text.owner, '我方');
  assert.equal(occupied.text.note, '上次占领失败 · 损失 2 士兵');
  assert.deepEqual(occupied.action.buttons.map((button) => button.action), ['manage-city', 'rename-city']);
  assert.equal(ready.text.march, '行军耗时 2:00，已抵达待接管');
  assert.equal(ready.action.buttons[0].action, 'claim');
});

test('population view state formats jobs and button availability', () => {
  const view = UIStatePresenter.buildPopulationViewState({
    currentEra: 2,
    population: {
      total: 6,
      maxPop: 8,
      unassigned: 1,
      farmers: 3,
      scholars: 2,
      craftsmen: 1,
    },
  });

  assert.equal(view.text.title, '人才分配');
  assert.equal(view.text.subtitle, '核心岗位');
  assert.equal(view.text.total, 6);
  assert.equal(view.text.max, 8);
  assert.equal(view.text.unassigned, 1);
  assert.equal(view.text.population, 600);
  assert.equal(view.text.maxPopulation, 800);
  assert.equal(view.showCraftsman, true);
  assert.deepEqual(
    view.jobs.map((job) => [job.id, job.count, job.visible, job.canIncrease, job.canDecrease]),
    [
      ['farmer', 3, true, true, true],
      ['scholar', 2, true, true, true],
      ['craftsman', 1, true, true, true],
    ],
  );
});

test('population view state locks increase buttons without unassigned people', () => {
  const view = UIStatePresenter.buildPopulationViewState({
    currentEra: 1,
    population: {
      total: 3,
      max: 3,
      unassigned: 0,
      farmers: 3,
      scholars: 0,
      craftsmen: 0,
    },
  });

  assert.equal(view.text.max, 3);
  assert.equal(view.showCraftsman, false);
  assert.deepEqual(
    view.jobs.map((job) => [job.id, job.visible, job.canIncrease, job.canDecrease]),
    [
      ['farmer', true, false, true],
      ['scholar', true, false, false],
      ['craftsman', false, false, false],
    ],
  );
});

test('population view state allows decreasing craftsmen without unassigned people', () => {
  const view = UIStatePresenter.buildPopulationViewState({
    currentEra: 2,
    population: {
      total: 4,
      max: 4,
      unassigned: 0,
      farmers: 2,
      scholars: 1,
      craftsmen: 1,
    },
  });

  const craftsman = view.jobs.find((job) => job.id === 'craftsman');

  assert.equal(craftsman.count, 1);
  assert.equal(craftsman.canIncrease, false);
  assert.equal(craftsman.canDecrease, true);
  assert.equal(craftsman.count, 1);
});

test('talent policy view state builds presets and tier draft without using custom policy as base', () => {
  const view = UIStatePresenter.buildTalentPolicyViewState({
    currentEra: 2,
    population: { total: 4 },
    talentPolicies: {
      activePolicyId: 'custom_1',
      activePolicyLabel: '均衡发展·偏工业',
      defaultTiers: { agriculture: 2, knowledge: 2, industry: 2 },
      systemPolicies: [
        { id: 'balanced', label: '均衡发展', description: '稳定分工', weights: { farmer: 2, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
        { id: 'agriculture', label: '农业优先', description: '重视农业', weights: { farmer: 4, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
      ],
      customPolicies: [
        { id: 'custom_1', displayName: '均衡发展·偏工业', tiers: { agriculture: 1, knowledge: 2, industry: 3 } },
      ],
      tendencies: [
        { id: 'agriculture', label: '农业', role: 'farmer', disabled: false },
        { id: 'knowledge', label: '知识', role: 'scholar', disabled: false },
        { id: 'industry', label: '工业', role: 'craftsman', disabled: false },
      ],
      preview: {
        allocation: { farmer: 2, scholar: 1, craftsman: 1 },
      },
    },
  }, { tiers: { agriculture: 3, knowledge: 2, industry: 1 } });

  assert.equal(view.activePolicyLabel, '均衡发展·偏工业');
  assert.equal(view.draft.basePolicyId, 'balanced');
  assert.equal(view.draft.displayName, '均衡发展·偏农业');
  assert.equal(view.tendencies.find((item) => item.id === 'agriculture').tierLabel, '高');
  assert.equal(view.systemPolicies[0].selected, true);
  assert.equal(view.customPolicies[0].active, true);
  assert.equal(view.preview.allocationText, '农民 3 / 学者 1 / 工匠 0');
});

test('city planning and guidebook view states expose terrain and habitability', () => {
  const state = {
    activeCityId: 'capital',
    cityState: {
      activeCityId: 'capital',
      cities: [{
        id: 'capital',
        name: '首都',
        population: { total: 4 },
        totalBuildings: 3,
        planning: {
          terrainId: 'river',
          terrainLabel: '河谷',
          terrainHint: '河谷适合粮食与民居搭配。',
          habitability: 12,
          habitabilityLabel: '良好',
          habitabilityTone: 'good',
          habitabilitySummary: '河谷城市规划良好',
          habitabilityNotes: ['居住与粮食配套较协调。'],
        },
      }],
    },
    guidebook: {
      categories: [
        { id: 'planning', label: '规划', title: '城市规划', lines: ['宜居度来自建筑搭配。'] },
        { id: 'policy', label: '方针', title: '人才方针', lines: ['方针会调整人才。'] },
      ],
    },
  };

  const planning = UIStatePresenter.buildCityPlanningViewState(state);
  assert.equal(planning.terrainLabel, '河谷');
  assert.equal(planning.text.habitabilityStatus, '宜居度良好');
  assert.equal(planning.habitabilityLabel, '良好');
  assert.equal(planning.populationGrowthMultiplier, 1.12);
  assert.equal(planning.text.populationGrowthStatus, '人口成长良好');

  const guidebook = UIStatePresenter.buildGuidebookViewState(state, { activeTab: 'planning' });
  assert.equal(guidebook.subtitle, '河谷 · 宜居度良好');
  assert.equal(guidebook.activeCategory.title, '城市规划');
});

test('talent policy view state follows the applied policy for title and preset active state', () => {
  const view = UIStatePresenter.buildTalentPolicyViewState({
    currentEra: 2,
    population: { total: 4 },
    talentPolicies: {
      activePolicyId: 'agriculture',
      activePolicyLabel: '均衡发展',
      defaultTiers: { agriculture: 2, knowledge: 2, industry: 2 },
      systemPolicies: [
        { id: 'balanced', label: '均衡发展', description: '稳定分工', weights: { farmer: 2, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
        { id: 'agriculture', label: '农业优先', description: '重视农业', weights: { farmer: 4, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
        { id: 'knowledge', label: '知识优先', description: '重视知识', weights: { farmer: 2, scholar: 3, craftsman: 1 }, priority: ['scholar', 'farmer', 'craftsman'] },
      ],
      customPolicies: [],
      tendencies: [
        { id: 'agriculture', label: '农业', role: 'farmer', disabled: false },
        { id: 'knowledge', label: '知识', role: 'scholar', disabled: false },
        { id: 'industry', label: '工业', role: 'craftsman', disabled: false },
      ],
      preview: {
        policyLabel: '农业优先',
        allocation: { farmer: 3, scholar: 0, craftsman: 0 },
      },
    },
  });

  assert.equal(view.activePolicyLabel, '农业优先');
  assert.equal(view.text.subtitle, '当前：农业优先');
  assert.equal(view.draft.basePolicyId, 'agriculture');
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'balanced').active, false);
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'balanced').selected, false);
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'agriculture').active, true);
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'agriculture').selected, true);
});

test('talent policy view state previews selected preset before confirmation', () => {
  const view = UIStatePresenter.buildTalentPolicyViewState({
    currentEra: 2,
    population: { total: 6 },
    talentPolicies: {
      activePolicyId: 'balanced',
      activePolicyLabel: '均衡发展',
      defaultTiers: { agriculture: 2, knowledge: 2, industry: 2 },
      systemPolicies: [
        { id: 'balanced', label: '均衡发展', weights: { farmer: 2, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
        { id: 'industry', label: '工业优先', weights: { farmer: 2, scholar: 1, craftsman: 3 }, priority: ['craftsman', 'farmer', 'scholar'] },
      ],
      customPolicies: [],
      tendencies: [
        { id: 'agriculture', label: '农业', role: 'farmer', disabled: false },
        { id: 'knowledge', label: '知识', role: 'scholar', disabled: false },
        { id: 'industry', label: '工业', role: 'craftsman', disabled: false },
      ],
      preview: {
        policyLabel: '均衡发展',
        allocation: { farmer: 3, scholar: 2, craftsman: 1 },
      },
    },
  }, { basePolicyId: 'industry' });

  assert.equal(view.text.subtitle, '当前：均衡发展 / 预览：工业优先');
  assert.equal(view.draft.basePolicyId, 'industry');
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'balanced').active, true);
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'balanced').selected, false);
  assert.equal(view.systemPolicies.find((policy) => policy.id === 'industry').selected, true);
  assert.equal(view.preview.allocationText, '农民 2 / 学者 1 / 工匠 3');
});
