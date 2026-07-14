#!/usr/bin/env node

const BuildingConfig = require('../backend/config/BuildingConfig');
const BuildingEffectCalculator = require('../backend/calculators/BuildingEffectCalculator');
const ResourceTickCalculator = require('../backend/calculators/ResourceTickCalculator');
const { getAdvanceConfig } = require('../backend/config/EraConfig');

const RESOURCE_KEYS = ['food', 'wood', 'knowledge', 'iron', 'stone'];
const RESOURCE_LABELS = {
  food: '粮食',
  wood: '木材',
  knowledge: '知识',
  iron: '铁矿',
  stone: '石料',
  soldiers: '士兵',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyResources() {
  return { food: 0, wood: 0, knowledge: 0, iron: 0, stone: 0 };
}

function addToBucket(bucket, values = {}, multiplier = 1) {
  for (const [key, rawValue] of Object.entries(values || {})) {
    const value = Number(rawValue) || 0;
    bucket[key] = (bucket[key] || 0) + value * multiplier;
  }
}

function formatAmount(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 100) return number.toFixed(0);
  if (Math.abs(number) >= 10) return number.toFixed(1).replace(/\.0$/, '');
  return number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatResources(resources = {}) {
  const parts = Object.entries(resources)
    .filter(([, value]) => Math.abs(Number(value) || 0) > 0.0001)
    .map(([key, value]) => `${RESOURCE_LABELS[key] || key}${formatAmount(value)}`);
  return parts.length ? parts.join(' / ') : '无';
}

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return '不可达';
  if (seconds < 60) return `${formatAmount(seconds)}秒`;
  return `${formatAmount(seconds / 60)}分钟`;
}

function getBuildingLevels(buildings = {}) {
  const levels = {};
  for (const id of Object.keys(BuildingConfig.getAllBuildings())) {
    const value = buildings[id];
    levels[id] = value?.level || value || 0;
  }
  return levels;
}

function setBuildingLevel(state, buildingId, level) {
  state.buildings[buildingId] = level > 0 ? { level } : null;
}

function getEffects(state) {
  return BuildingEffectCalculator.calculate(state.buildings || {});
}

function getOutputs(state) {
  return ResourceTickCalculator.calculateOutputs({
    population: state.population,
    buildings: state.buildings,
    happiness: state.happiness,
    activeBuffs: state.activeBuffs || [],
  }, getEffects(state));
}

function createInitialState() {
  const buildings = {};
  for (const id of Object.keys(BuildingConfig.getAllBuildings())) buildings[id] = null;
  return {
    currentEra: 0,
    resources: { food: 100, wood: 0, knowledge: 0, iron: 0, stone: 0 },
    buildings,
    population: { total: 3, farmers: 3, scholars: 0, craftsmen: 0, unassigned: 0 },
    happiness: 100,
    soldiers: 0,
  };
}

function createLedger() {
  return {
    initial: emptyResources(),
    production: emptyResources(),
    taskRewards: emptyResources(),
    eventRewards: emptyResources(),
    eraRewards: emptyResources(),
    buildingSpend: emptyResources(),
    eraSpend: emptyResources(),
    waits: [],
    rewardCoverages: [],
  };
}

function advanceTime(state, seconds, ledger, reason) {
  const duration = Math.max(0, Number(seconds) || 0);
  if (duration <= 0) return;
  const outputs = getOutputs(state);
  const produced = {
    food: Math.max(0, outputs.foodPerSecond * duration),
    wood: Math.max(0, outputs.woodPerSecond * duration),
    knowledge: Math.max(0, outputs.knowledgePerSecond * duration),
    iron: Math.max(0, outputs.ironPerSecond * duration),
    stone: Math.max(0, outputs.stonePerSecond * duration),
  };
  addToBucket(ledger.production, produced);
  for (const key of RESOURCE_KEYS) {
    state.resources[key] = Math.max(0, (state.resources[key] || 0) + (outputs[`${key}PerSecond`] || 0) * duration);
  }
  ledger.waits.push({ reason, seconds: duration, outputs, produced });
}

function secondsUntilAffordable(state, cost = {}) {
  const outputs = getOutputs(state);
  let wait = 0;
  const blockers = [];
  for (const [key, required] of Object.entries(cost || {})) {
    const missing = Math.max(0, (Number(required) || 0) - (state.resources[key] || 0));
    if (missing <= 0) continue;
    const rate = outputs[`${key}PerSecond`] || 0;
    if (rate <= 0) {
      blockers.push({ key, missing, rate });
      continue;
    }
    wait = Math.max(wait, missing / rate);
  }
  return { wait: blockers.length ? Infinity : wait, blockers, outputs };
}

function ensureAffordable(state, cost, ledger, reason) {
  const affordability = secondsUntilAffordable(state, cost);
  if (affordability.wait > 0 && Number.isFinite(affordability.wait)) {
    advanceTime(state, affordability.wait, ledger, reason);
  }
  return affordability;
}

function spendResources(state, cost, ledger, bucket) {
  addToBucket(ledger[bucket], cost);
  for (const [key, value] of Object.entries(cost || {})) {
    state.resources[key] = Math.max(0, (state.resources[key] || 0) - (Number(value) || 0));
  }
}

function grantResources(state, reward, ledger, bucket) {
  addToBucket(ledger[bucket], reward);
  for (const [key, value] of Object.entries(reward || {})) {
    state.resources[key] = (state.resources[key] || 0) + (Number(value) || 0);
  }
}

function compareRewardToNextCost(label, reward, nextCost, ledger) {
  const rows = Object.entries(nextCost || {}).map(([key, cost]) => ({
    key,
    reward: Number(reward?.[key]) || 0,
    cost: Number(cost) || 0,
    coverage: cost > 0 ? ((Number(reward?.[key]) || 0) / cost) : null,
  }));
  ledger.rewardCoverages.push({ label, rows });
}

function getEraCost(currentEra) {
  return clone(getAdvanceConfig(currentEra)?.cost || {});
}

function runMainline() {
  const state = createInitialState();
  const ledger = createLedger();
  addToBucket(ledger.initial, state.resources);

  const steps = [];
  function record(action) {
    steps.push({
      action,
      era: state.currentEra,
      resources: clone(state.resources),
      population: clone(state.population),
      soldiers: state.soldiers,
      buildings: getBuildingLevels(state.buildings),
    });
  }

  function advanceEra() {
    const currentEra = state.currentEra;
    const cost = getEraCost(currentEra);
    ensureAffordable(state, cost, ledger, `等待进阶时代 ${currentEra}->${currentEra + 1}`);
    spendResources(state, cost, ledger, 'eraSpend');
    state.currentEra += 1;
    if (state.currentEra === 1) grantResources(state, { knowledge: 5 }, ledger, 'eraRewards');
    if (state.currentEra === 2) {
      state.population.total += 1;
      state.population.unassigned += 1;
    }
    record(`进阶到时代 ${state.currentEra}`);
  }

  function build(buildingId) {
    const cost = BuildingConfig.getBuildCost(buildingId);
    ensureAffordable(state, cost, ledger, `等待建造 ${buildingId}`);
    spendResources(state, cost, ledger, 'buildingSpend');
    setBuildingLevel(state, buildingId, 1);
    record(`建造 ${buildingId}`);
  }

  function upgrade(buildingId) {
    const level = getBuildingLevels(state.buildings)[buildingId];
    const cost = BuildingConfig.getUpgradeCost(buildingId, level);
    ensureAffordable(state, cost, ledger, `等待升级 ${buildingId}`);
    spendResources(state, cost, ledger, 'buildingSpend');
    setBuildingLevel(state, buildingId, level + 1);
    record(`升级 ${buildingId} 到 ${level + 1}`);
  }

  function task(label, reward, nextCost) {
    grantResources(state, reward.resources || {}, ledger, 'taskRewards');
    if (reward.soldiers) state.soldiers += reward.soldiers;
    if (nextCost) compareRewardToNextCost(label, reward.resources || {}, nextCost, ledger);
    record(`任务奖励：${label}`);
  }

  function event(label, reward) {
    grantResources(state, reward, ledger, 'eventRewards');
    record(`事件奖励：${label}`);
  }

  advanceEra();
  build('farm');
  build('house');
  task('备齐聚落物资', { resources: getEraCost(1) }, getEraCost(1));
  advanceEra();
  event('森林低语', { wood: 20 });
  task('备齐伐木物资', { resources: BuildingConfig.getBuildCost('lumbermill') }, BuildingConfig.getBuildCost('lumbermill'));
  build('lumbermill');
  state.population.farmers = 3;
  state.population.craftsmen = 1;
  state.population.scholars = 0;
  state.population.unassigned = Math.max(0, state.population.total - 4);
  record('分配 1 工匠');
  task('聚落分工', { resources: getEraCost(2) }, getEraCost(2));
  advanceEra();
  task('城邦守备', { resources: BuildingConfig.getBuildCost('barracks') }, BuildingConfig.getBuildCost('barracks'));
  build('barracks');
  task('守备成军', { resources: getEraCost(3), soldiers: 3 }, getEraCost(3));
  advanceEra();
  task('边境瞭望', { resources: BuildingConfig.getBuildCost('watchtower') }, BuildingConfig.getBuildCost('watchtower'));
  build('watchtower');
  task('扩编兵营', { resources: BuildingConfig.getUpgradeCost('barracks', 1) }, BuildingConfig.getUpgradeCost('barracks', 1));
  upgrade('barracks');
  task('古典远行', { resources: getEraCost(4), soldiers: 6 }, getEraCost(4));
  advanceEra();

  return { state, ledger, steps };
}

function timeToCostFromState(name, state, targetCost) {
  const affordability = secondsUntilAffordable(state, targetCost);
  const limiting = [];
  const outputs = affordability.outputs;
  for (const [key, cost] of Object.entries(targetCost)) {
    const missing = Math.max(0, (Number(cost) || 0) - (state.resources[key] || 0));
    const rate = outputs[`${key}PerSecond`] || 0;
    limiting.push({
      key,
      missing,
      rate,
      seconds: missing <= 0 ? 0 : rate > 0 ? missing / rate : Infinity,
    });
  }
  limiting.sort((a, b) => b.seconds - a.seconds);
  return { name, state, targetCost, outputs, limiting, totalSeconds: limiting[0]?.seconds || 0 };
}

function createOrganicCheckpoints() {
  const era2 = createInitialState();
  era2.currentEra = 2;
  era2.resources = { food: 0, wood: 5, knowledge: 5, iron: 0, stone: 0 };
  setBuildingLevel(era2, 'farm', 1);
  setBuildingLevel(era2, 'house', 1);
  setBuildingLevel(era2, 'lumbermill', 1);
  era2.population = { total: 4, farmers: 3, scholars: 0, craftsmen: 1, unassigned: 0 };

  const era3 = clone(era2);
  era3.currentEra = 3;
  era3.resources = { food: 0, wood: 0, knowledge: 0, iron: 0, stone: 0 };
  setBuildingLevel(era3, 'barracks', 1);
  era3.population = { total: 6, farmers: 3, scholars: 1, craftsmen: 2, unassigned: 0 };

  const era4 = clone(era3);
  era4.currentEra = 4;
  era4.resources = { food: 0, wood: 0, knowledge: 0, iron: 0, stone: 0 };
  setBuildingLevel(era4, 'watchtower', 1);
  setBuildingLevel(era4, 'barracks', 2);

  return [
    timeToCostFromState('无主线奖励：聚落 -> 城邦', era2, getEraCost(2)),
    timeToCostFromState('无主线奖励：城邦 -> 边境', era3, getEraCost(3)),
    timeToCostFromState('无主线奖励：边境 -> 古典', era4, getEraCost(4)),
  ];
}

function marginalBuildingEffect(buildingId, field, level) {
  return BuildingConfig.calculateEffectBonus(buildingId, field, level + 1)
    - BuildingConfig.calculateEffectBonus(buildingId, field, level);
}

function directPaybackRows() {
  const rows = [];
  function push(row) {
    rows.push(row);
  }

  for (let level = 0; level <= 5; level += 1) {
    const cost = level === 0 ? BuildingConfig.getBuildCost('farm') : BuildingConfig.getUpgradeCost('farm', level);
    const deltaMultiplier = marginalBuildingEffect('farm', 'foodOutputMultiplier', level);
    const deltaFood3 = deltaMultiplier * 3;
    const deltaFood6 = deltaMultiplier * 6;
    push({
      item: `农田 ${level}->${level + 1}`,
      cost,
      delta: `+${formatAmount(deltaFood3)} 粮/s(3农民) / +${formatAmount(deltaFood6)} 粮/s(6农民)`,
      payback: deltaFood3 > 0 && cost.food ? cost.food / deltaFood3 : 0,
      note: level === 0 ? '免费建造，必点' : '粮食换粮食',
    });
  }

  for (let level = 0; level <= 5; level += 1) {
    const cost = level === 0 ? BuildingConfig.getBuildCost('lumbermill') : BuildingConfig.getUpgradeCost('lumbermill', level);
    const deltaBase = marginalBuildingEffect('lumbermill', 'woodOutputBase', level);
    const deltaWood1 = deltaBase * 1;
    const deltaWood2 = deltaBase * 2;
    push({
      item: `伐木场 ${level}->${level + 1}`,
      cost,
      delta: `+${formatAmount(deltaWood1)} 木/s(1工匠) / +${formatAmount(deltaWood2)} 木/s(2工匠)`,
      payback: deltaWood1 > 0 && cost.wood ? cost.wood / deltaWood1 : 0,
      note: level === 0 ? '需要先获得木材，建成后回本极快' : '木材换木材',
    });
  }

  for (let level = 0; level <= 3; level += 1) {
    const cost = level === 0 ? BuildingConfig.getBuildCost('academy') : BuildingConfig.getUpgradeCost('academy', level);
    const deltaMultiplier = marginalBuildingEffect('academy', 'knowledgeOutputMultiplier', level);
    const deltaKnowledge2 = 2 * 0.15 * deltaMultiplier;
    const deltaKnowledge5 = 5 * 0.15 * deltaMultiplier;
    push({
      item: `学院 ${level}->${level + 1}`,
      cost,
      delta: `+${formatAmount(deltaKnowledge2)} 知/s(2学者) / +${formatAmount(deltaKnowledge5)} 知/s(5学者)`,
      payback: deltaKnowledge2 > 0 && cost.knowledge ? cost.knowledge / deltaKnowledge2 : 0,
      note: '当前未实际解锁；知识回本明显慢于粮木',
    });
  }

  return rows;
}

function printMainline(result) {
  const { ledger, state } = result;
  const totalWait = ledger.waits.reduce((sum, wait) => sum + wait.seconds, 0);
  const totalSpend = {};
  addToBucket(totalSpend, ledger.buildingSpend);
  addToBucket(totalSpend, ledger.eraSpend);
  const totalSources = {};
  addToBucket(totalSources, ledger.initial);
  addToBucket(totalSources, ledger.production);
  addToBucket(totalSources, ledger.taskRewards);
  addToBucket(totalSources, ledger.eventRewards);
  addToBucket(totalSources, ledger.eraRewards);

  console.log('\n=== 当前主线闭环仿真 ===');
  console.log(`到古典时代总等待：${formatSeconds(totalWait)}`);
  console.log(`初始资源：${formatResources(ledger.initial)}`);
  console.log(`在线自然产出：${formatResources(ledger.production)}`);
  console.log(`任务奖励：${formatResources(ledger.taskRewards)}`);
  console.log(`事件奖励：${formatResources(ledger.eventRewards)}`);
  console.log(`时代额外奖励：${formatResources(ledger.eraRewards)}`);
  console.log(`建筑消耗：${formatResources(ledger.buildingSpend)}`);
  console.log(`时代消耗：${formatResources(ledger.eraSpend)}`);
  console.log(`总消耗：${formatResources(totalSpend)}`);
  console.log(`最终剩余：${formatResources(state.resources)}，士兵${state.soldiers}`);

  const naturalFoodShare = ((ledger.production.food || 0) / Math.max(1, totalSpend.food || 0)) * 100;
  const naturalKnowledgeShare = ((ledger.production.knowledge || 0) / Math.max(1, totalSpend.knowledge || 0)) * 100;
  const taskFoodShare = ((ledger.taskRewards.food || 0) / Math.max(1, totalSpend.food || 0)) * 100;
  const taskWoodShare = ((ledger.taskRewards.wood || 0) / Math.max(1, totalSpend.wood || 0)) * 100;
  const taskKnowledgeShare = ((ledger.taskRewards.knowledge || 0) / Math.max(1, totalSpend.knowledge || 0)) * 100;
  console.log(`自然产出占总消耗：粮食 ${formatAmount(naturalFoodShare)}% / 知识 ${formatAmount(naturalKnowledgeShare)}%`);
  console.log(`主线任务占总消耗：粮食 ${formatAmount(taskFoodShare)}% / 木材 ${formatAmount(taskWoodShare)}% / 知识 ${formatAmount(taskKnowledgeShare)}%`);

  console.log('\n奖励覆盖下一步成本：');
  for (const coverage of ledger.rewardCoverages) {
    const text = coverage.rows.map((row) => `${RESOURCE_LABELS[row.key] || row.key}${formatAmount(row.reward)}/${formatAmount(row.cost)}=${formatAmount(row.coverage * 100)}%`).join('，');
    console.log(`- ${coverage.label}: ${text}`);
  }
}

function printOrganicCheckpoints(checkpoints) {
  console.log('\n=== 去掉主线报销后的底层经济压力 ===');
  for (const checkpoint of checkpoints) {
    const bottleneck = checkpoint.limiting[0];
    const rates = {
      food: checkpoint.outputs.foodPerSecond,
      wood: checkpoint.outputs.woodPerSecond,
      knowledge: checkpoint.outputs.knowledgePerSecond,
    };
    console.log(`\n${checkpoint.name}`);
    console.log(`目标成本：${formatResources(checkpoint.targetCost)}`);
    console.log(`当前产速：${formatResources(rates)}/秒`);
    console.log(`预计等待：${formatSeconds(checkpoint.totalSeconds)}，瓶颈：${RESOURCE_LABELS[bottleneck.key]} ${formatSeconds(bottleneck.seconds)}`);
    console.log(`缺口排序：${checkpoint.limiting.map((item) => `${RESOURCE_LABELS[item.key]}缺${formatAmount(item.missing)}(${formatSeconds(item.seconds)})`).join(' / ')}`);
  }
}

function printPayback(rows) {
  console.log('\n=== 建筑边际回本测试 ===');
  for (const row of rows) {
    console.log(`- ${row.item}: 成本 ${formatResources(row.cost)}；增量 ${row.delta}；直接回本 ${formatSeconds(row.payback)}；${row.note}`);
  }
}

function printConclusions() {
  console.log('\n=== 模型结论 ===');
  console.log('1. 当前新手到古典的主线不是收支平衡，而是任务奖励报销成本；自然产出只参与开局几秒。');
  console.log('2. 粮食和木材生产建筑回本过快，且没有维护成本，生产类升级接近无脑正收益。');
  console.log('3. 知识产出明显偏慢，但主线奖励把知识缺口直接填平，所以玩家感受不到知识经济。');
  console.log('4. 木材在底层经济里会成为聚落后的核心资源，但任务奖励同样完整覆盖，导致伐木场价值被削弱。');
  console.log('5. 铁矿和石料当前没有产出、消耗、奖励闭环，属于展示资源，不参与平衡。');
  console.log('6. 维护成本未生效，长期经济只有正产出，没有持续消耗，越玩越容易堆资源。');
  console.log('7. 兵营 2 级后继续升级只涨成本不涨军事能力，属于明确的数值断点。');
}

function main() {
  console.log(`配置版本：${BuildingConfig.getVersion()}`);
  const mainline = runMainline();
  printMainline(mainline);
  printOrganicCheckpoints(createOrganicCheckpoints());
  printPayback(directPaybackRows());
  printConclusions();
}

main();
