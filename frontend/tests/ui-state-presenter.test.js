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

test('resource view state is renderer-neutral and formats resource display', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 2,
    resources: {
      food: 12.8,
      knowledge: 5.2,
      wood: 30.9,
      foodOutputPerSecond: 1.5,
      foodConsumptionPerSecond: 0.25,
      foodNetPerSecond: 1.25,
      knowledgePerSecond: 0.4,
      woodPerSecond: 0,
    },
    happiness: 92,
    gameDay: 7,
  });

  assert.equal(view.hasWood, true);
  assert.equal(view.text.foodValue, 12);
  assert.equal(view.text.knowledgeValue, 5);
  assert.equal(view.text.woodValue, 30);
  assert.equal(view.text.foodRate, '+1.25/s');
  assert.equal(view.text.foodConsumptionRate, '-0.25/s');
  assert.equal(view.text.knowledgeRate, '+0.4/s');
  assert.equal(view.text.woodRate, '+0/s');
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
  assert.equal(view.text.foodOutputRate, '+1.2k/s');
  assert.equal(view.text.foodConsumptionRate, '-1.1k/s');
  assert.equal(view.text.woodRate, '+1T/s');
});

test('resource view state hides wood before settlement era', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 1,
    resources: {
      food: 4,
      knowledge: 2,
      wood: 99,
      foodPerSecond: -0.5,
    },
  });

  assert.equal(view.hasWood, false);
  assert.equal(view.text.woodValue, 0);
  assert.equal(view.text.woodRate, '+0/s');
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
  assert.equal(view.options[1].metaText, '人口 3 · 建筑 1');
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
    { textContent: '第一条' },
    { textContent: '第二条' },
  ]);

  assert.equal(advisor.hidden, false);
  assert.equal(advisor.goButton.disabled, false);
  assert.equal(UIStatePresenter.getAdvisorTargetTab(advisor.activeAdvisor.target), 'military');
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
      ui: {
        effectText: [{ field: 'foodOutputBonus', label: 'Food output', format: 'percent' }],
      },
    },
  });

  assert.equal(view.isEmpty, false);
  assert.equal(view.cards[0].id, 'farm');
  assert.equal(view.cards[0].levelText, '等级 1');
  assert.equal(view.cards[0].effectText, 'Food output +100%');
  assert.deepEqual(view.cards[0].cost.parts.map((part) => [part.resource, part.text]), [
    ['food', '1.2k'],
    ['wood', '1M'],
  ]);
  assert.equal(view.cards[0].button.action, 'upgrade');
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

  assert.equal(view.text.techKnowledgeRate, '1.25/s');
  assert.deepEqual(view.badge, { hidden: false, text: '2' });
  assert.equal(view.pending.isEmpty, false);
  assert.equal(view.pending.cards[0].hint, '剩余 4:00，超时将自动失效');
  assert.equal(view.pending.cards[0].classState['is-special'], false);
  assert.equal(view.pending.cards[1].hint, '剩余 5:00，超时将按失败处理');
  assert.equal(view.pending.cards[1].classState['is-threat'], true);
  assert.equal(view.history.items[0].result, '🌾 +1.2k');
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

  assert.equal(multi.text.title, 'H Harvest Sign');
  assert.equal(multi.text.reward, '选择一种处理方式 | 剩余 4:00，超时将自动失效');
  assert.equal(multi.options[1].preview, '📚 +1.2k');
  assert.equal(multi.claimButton.hidden, true);

  const single = UIStatePresenter.buildEventModalViewState({
    title: 'Forest',
    options: [{ id: 'collect', label: 'Collect', reward: { wood: 20 } }],
  });

  assert.equal(single.text.reward, '🪵 +20');
  assert.deepEqual(single.claimButton, { optionId: 'collect', label: 'Collect', hidden: false });
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
  assert.equal(north.className, 'direction-n status-active');
  assert.equal(north.actionText, '0:30');
  assert.equal(north.disabled, true);
  assert.equal(east.className, 'direction-e status-locked');
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
  assert.match(siteA.className, /owner-neutral/);
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

  assert.equal(view.text.totalPop, 6);
  assert.equal(view.text.maxPop, 8);
  assert.equal(view.text.unassignedPop, 1);
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

  assert.equal(view.text.maxPop, 3);
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
  assert.equal(view.text.craftsmanCount, 1);
});
